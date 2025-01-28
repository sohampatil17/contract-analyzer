export class DocuSignService {
  private baseUrl: string;
  private accessToken: string;
  private accountId: string;

  constructor() {
    this.baseUrl = process.env.DOCUSIGN_BASE_PATH || '';
    this.accessToken = process.env.DOCUSIGN_ACCESS_TOKEN || '';
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
  }

  async createEnvelope(document: Buffer, signers: Array<{ name: string, email: string }>) {
    try {
      const envelope = {
        emailSubject: 'Please sign this document',
        documents: [{
          documentBase64: document.toString('base64'),
          name: 'Contract.pdf',
          fileExtension: 'pdf',
          documentId: '1'
        }],
        recipients: {
          signers: signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: (index + 1).toString(),
            routingOrder: (index + 1).toString(),
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '100',
                yPosition: '100'
              }]
            }
          }))
        },
        status: 'sent'
      };

      const response = await fetch(`${this.baseUrl}/v2.1/accounts/${this.accountId}/envelopes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ envelopeDefinition: envelope })
      });

      if (!response.ok) throw new Error('Failed to create envelope');
      return await response.json();
    } catch (error) {
      console.error('DocuSign Error:', error);
      throw error;
    }
  }
} 