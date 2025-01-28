"use client"

import React, { useState } from 'react';
import { Upload, FileText, Calendar, AlertTriangle, FileIcon, MessageCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "./ui/button";
import { DocuSignService } from '@/lib/docusign';
import Image from 'next/image';

interface Analysis {
  summary: string;
  risks: Array<{ severity: string; description: string }>;
  dates: Array<{ type: string; date: string }>;
  text?: string;
  parties?: Array<{ role: string; name: string }>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ContractAnalyzer = () => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [contractText, setContractText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [signingInProgress, setSigningInProgress] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] as File;
    if (file) {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://localhost:8001/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const result = await response.json();
        setContractText(result.text);
        setSelectedFile(file);
        setAnalysis(result);
      } catch (error: Error | unknown) {
        console.error('Error:', error);
        alert(error instanceof Error ? error.message : 'Failed to analyze contract. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAskQuestion = async () => {
    if (!query.trim() || !contractText) return;

    try {
      setLoading(true);
      const newMessage: Message = { role: 'user', content: query };
      setMessages(prev => [...prev, newMessage]);
      setQuery('');

      const response = await fetch('http://localhost:8001/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          text: contractText
        })
      });

      if (!response.ok) throw new Error('Failed to get answer');
      
      const data = await response.json();
      const aiMessage: Message = { role: 'assistant', content: data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to get answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToGoogleCalendar = (date: { type: string; date: string }) => {
    const event = {
      text: `Contract Date: ${date.type}`,
      dates: date.date,
      details: `Contract deadline for ${date.type}`,
    };

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.text)}&dates=${event.dates}&details=${encodeURIComponent(event.details)}`;
    window.open(calendarUrl, '_blank');
  };

  const handleDocuSign = async () => {
    if (!selectedFile) return;

    try {
      setSigningInProgress(true);
      const docuSign = new DocuSignService();
      
      // Get file as buffer
      const buffer = await selectedFile.arrayBuffer();
      
      // Example signers - you'll need to get these from user input
      const signers = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' }
      ];

      await docuSign.createEnvelope(Buffer.from(buffer), signers);
      alert('Document sent for signing!');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to send document for signing');
    } finally {
      setSigningInProgress(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-6 text-[#2B5672]">Contract Analyzer</h1>
      
      {!selectedFile ? (
        // Upload section
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle>Upload Contract</CardTitle>
            <CardDescription>Upload your contract document for analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-[#2B5672] transition-colors">
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="contract-upload"
                accept=".pdf,.doc,.docx"
              />
              <label
                htmlFor="contract-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload className="h-12 w-12 mb-2 text-[#2B5672]" />
                <span className="text-sm text-gray-600">
                  Click to upload or drag and drop
                </span>
              </label>
            </div>
            {selectedFile && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center">
                <FileIcon className="mr-2 text-[#2B5672]" />
                <span>{(selectedFile as File)?.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[#2B5672]/20 border-t-[#2B5672] rounded-full animate-spin"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-8 h-8 border-4 border-transparent border-t-[#4A90E2] rounded-full animate-spin animation-delay-150"></div>
              </div>
            </div>
            <p className="text-[#2B5672] font-medium text-lg">Analyzing your contract...</p>
            <p className="text-sm text-gray-500">Using advanced AI to process your document</p>
          </div>
        </div>
      ) : analysis ? (
        // Analysis display
        <div className="flex gap-6">
          {/* PDF Viewer */}
          <div className="w-1/2 h-[calc(100vh-200px)] border rounded-lg bg-white p-4">
            <iframe
              src={selectedFile ? URL.createObjectURL(selectedFile) : ''}
              className="w-full h-full"
              title="Contract PDF"
            />
          </div>

          {/* Analysis Tabs */}
          <div className="w-1/2">
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 bg-white">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="risks">Risks</TabsTrigger>
                <TabsTrigger value="dates">Key Dates</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-black">
                      <FileText className="mr-2" /> Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose max-w-none">
                      <p className="text-base text-black">{analysis.summary}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="risks">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-black">
                      <AlertTriangle className="mr-2" /> Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {analysis.risks.map((risk, index) => (
                        <Alert 
                          key={index} 
                          variant={risk.severity as 'high' | 'medium' | 'low'}
                          className="text-black"
                        >
                          <AlertDescription className="text-base font-normal">
                            <span className="font-semibold capitalize">{risk.severity}: </span>
                            {risk.description}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dates">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-black">
                      <Calendar className="mr-2" /> Key Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2">
                      {analysis.dates
                        .filter(date => {
                          try {
                            return !isNaN(new Date(date.date).getTime());
                          } catch {
                            return false;
                          }
                        })
                        .map((date, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow">
                            <div className="flex-grow">
                              <span className="text-base text-black font-medium">{date.type}</span>
                              <span className="ml-4 text-base text-black">
                                {new Date(date.date).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              onClick={() => addToGoogleCalendar(date)}
                              className="px-4 py-2 text-sm bg-[#2B5672] text-white rounded hover:bg-[#1a3f5c] transition-colors w-36"
                            >
                              Add to Calendar
                            </button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qa">
                <Card className="h-[calc(100vh-200px)]">
                  <CardHeader>
                    <CardTitle className="flex items-center text-black">
                      <MessageCircle className="mr-2" /> Contract Q&A
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[calc(100%-5rem)] flex flex-col">
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 border rounded-lg bg-gray-50">
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.role === 'user'
                                ? 'bg-[#2B5672] text-white'
                                : 'bg-gray-100 text-black'
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                        placeholder="Ask a question about the contract..."
                        className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2B5672]"
                      />
                      <Button
                        onClick={handleAskQuestion}
                        disabled={!query.trim() || loading}
                        className="bg-[#2B5672] text-white hover:bg-[#1a3f5c]"
                      >
                        {loading ? (
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Ask'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-64">
          <div className="text-red-500">Failed to analyze contract. Please try again.</div>
        </div>
      )}

      <Button
        onClick={handleDocuSign}
        disabled={!selectedFile || signingInProgress}
        className="bg-[#2B5672] text-white hover:bg-[#1a3f5c]"
      >
        {signingInProgress ? (
          <div className="flex items-center">
            <span className="animate-spin mr-2">⌛</span>
            Sending...
          </div>
        ) : (
          <>
            <Image src="/docusign-logo.svg" alt="DocuSign" width={20} height={20} className="mr-2" />
            Sign with DocuSign
          </>
        )}
      </Button>
    </div>
  );
};

export default ContractAnalyzer;