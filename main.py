from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os
from dotenv import load_dotenv
import datetime
from typing import List, Dict
import PyPDF2
import io

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

client = OpenAI(api_key=api_key)

class ContractAnalyzer:
    def __init__(self):
        self.client = OpenAI(api_key=api_key)

    async def extract_text_from_pdf(self, file_content: bytes) -> str:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text

    async def get_summary(self, text: str) -> str:
        response = self.client.chat.completions.create(
            model="gpt-4-0125-preview",  # Latest GPT-4 Turbo
            messages=[
                {
                    "role": "system", 
                    "content": """You are a legal document analyzer. Provide a clear, concise summary in 2-3 short sentences maximum.
                    Focus only on the core agreement points.
                    DO NOT use any special characters or formatting (no **, ##, -, etc.).
                    Keep it simple and direct."""
                },
                {"role": "user", "content": f"Summarize this contract:\n\n{text}"}
            ],
            temperature=0.3  # More focused output
        )
        return response.choices[0].message.content.strip()

    async def analyze_risks(self, text: str) -> List[Dict]:
        response = self.client.chat.completions.create(
            model="gpt-4-0125-preview",  # Latest GPT-4 Turbo
            messages=[
                {
                    "role": "system", 
                    "content": """Analyze the contract for risks. For each risk:
                    1. Classify severity as EXACTLY 'high', 'medium', or 'low'
                    2. Provide a clear, direct description without any formatting
                    3. Limit to 3-4 most important risks
                    
                    Format: severity: description"""
                },
                {"role": "user", "content": f"What are the key risks in this contract?\n\n{text}"}
            ],
            temperature=0.2  # More consistent output
        )
        risks = []
        for line in response.choices[0].message.content.split('\n'):
            if ':' in line:
                severity, description = line.split(':', 1)
                severity = severity.strip().lower()
                if severity in ['high', 'medium', 'low']:
                    risks.append({
                        "severity": severity,
                        "description": description.strip()
                    })
        return risks

    async def extract_dates(self, text: str) -> List[Dict]:
        response = self.client.chat.completions.create(
            model="gpt-4-0125-preview",  # Latest GPT-4 Turbo
            messages=[
                {
                    "role": "system", 
                    "content": "Extract important dates in YYYY-MM-DD format only. Focus on deadlines, effective dates, and termination dates."
                },
                {"role": "user", "content": f"Extract important dates from this contract. Format: type: YYYY-MM-DD (one per line):\n\n{text}"}
            ],
            temperature=0.1  # Most consistent output for date extraction
        )
        dates = []
        for line in response.choices[0].message.content.split('\n'):
            if line.strip():
                try:
                    date_type, date_str = line.split(':', 1)
                    date_str = date_str.strip()
                    datetime.datetime.strptime(date_str, '%Y-%m-%d')
                    dates.append({
                        "type": date_type.strip(),
                        "date": date_str
                    })
                except (ValueError, IndexError):
                    continue
        return dates

analyzer = ContractAnalyzer()

@app.post("/analyze")
async def analyze_contract(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = await analyzer.extract_text_from_pdf(contents)
        
        summary = await analyzer.get_summary(text)
        risks = await analyzer.analyze_risks(text)
        dates = await analyzer.extract_dates(text)
        
        return {
            "summary": summary,
            "risks": risks,
            "dates": dates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask")
async def ask_question(request: dict):
    try:
        question = request.get("question")
        text = request.get("text")
        
        if not question or not text:
            raise HTTPException(status_code=400, detail="Missing question or contract text")

        response = client.chat.completions.create(
            model="gpt-4-0125-preview",  # Latest GPT-4 Turbo
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful assistant that answers questions about contracts. Provide clear, direct answers."
                },
                {"role": "user", "content": f"Contract text: {text}\n\nQuestion: {question}"}
            ],
            temperature=0.3
        )
        
        return {"answer": response.choices[0].message.content}
    except Exception as e:
        print(f"Error in ask_question: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)