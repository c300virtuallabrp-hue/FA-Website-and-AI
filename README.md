# FYP Virtual Lab - Advanced File Analysis Chatbot with Report Generation

A comprehensive digital forensics platform supporting multiple file types with AI-powered analysis and professional report generation in Word document format.

## Features

### File Type Support
- **PCAP/PCAPng Files**: Network traffic analysis with AI-powered cybersecurity insights (Groq)
- **Memory Dumps**: Volatility-based memory forensics
- **Documents**: Office files (DOCX, XLSX, PDF) with password cracking
- **Data Files**: JSON, CSV analysis via AI
- **Text Files**: Content analysis

### Analysis Capabilities
- **Network Traffic Analysis**: Detect suspicious activities, protocol analysis, traffic patterns
- **Memory Forensics**: Extract artifacts from memory dumps
- **Password Cracking**: Automated hash generation and cracking for protected documents
- **AI-Powered Insights**: Groq integration for intelligent analysis
- **Professional Report Generation**: Export analysis results to formatted Word documents

### Report Generation
- **Word Document Export**: Generate comprehensive forensic reports in .docx format
- **Structured Analysis**: Organized sections with packet summaries, traffic analysis, and AI insights
- **Formatted Tables**: Professional tables for protocol distributions, top flows, and security findings
- **Complete Documentation**: Includes all analysis results in a downloadable report

## Prerequisites

- **Node.js** (v14+ recommended)
- **npm** for package management
- **Python 3.x** for PCAP analysis
- **Scapy** library: `pip install scapy`

### Optional Dependencies
- **Volatility3** for memory analysis
- **John the Ripper** for password cracking
- **Groq API** for AI analysis

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd FA-Website-and-AI
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install scapy
```

4. Configure environment variables:
```bash
cp .env.example .env
```

Edit the `.env` file with your API keys and configuration:
```env
# API Keys
GROQ_API_KEY=your-groq-api-key-here
# FLOWISE_API_URL=https://cloud.flowiseai.com/api/v1/prediction/your-flowise-endpoint-id

# Server Configuration
PORT=3000
UPLOADS_DIR=uploads

# AI Service Configuration
# FLOWISE_TIMEOUT=15000
# FLOWISE_RETRIES=2
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open browser to `http://localhost:3000`

3. Upload files using the web interface

4. Click "Analyze Uploaded Files" to process

5. Generate professional reports by typing "generate a report" in the chat

### Report Generation Features
- **Automatic Analysis**: Upload and analyze files with AI-powered insights
- **Word Document Export**: Generate comprehensive forensic reports
- **Structured Content**: Organized sections with summaries, tables, and findings
- **Downloadable Reports**: Save analysis results as .docx files for documentation

### Supported File Types

| File Type | Extension | Analysis Type |
|-----------|-----------|---------------|
| PCAP Network Capture | .pcap, .cap, .pcapng | Network traffic analysis |
| Memory Dump | .dmp, .mem | Volatility forensics |
| Office Documents | .docx, .xlsx, .pdf | Password cracking |
| Data Files | .json, .csv | AI analysis |
| Text Files | .txt, .log | Content analysis |

## PCAP Analysis Features

- **Packet Extraction**: Parse and extract packet data
- **Protocol Analysis**: Identify network protocols used
- **Traffic Patterns**: Analyze communication patterns
- **Suspicious Activity Detection**: Identify potential security threats
- **AI Insights**: Groq-powered cybersecurity analysis

## API Endpoints

- `POST /api/upload` - Upload single file
- `POST /api/upload-multiple` - Upload multiple files
- `POST /api/analyze` - Analyze uploaded files
- `POST /api/pcap/analyze` - Analyze PCAP files
- `POST /api/volatility/analyze` - Analyze memory dumps
- `POST /api/john/crack` - Password cracking

## Report Generation

The application supports generating professional Word documents containing comprehensive forensic analysis:

### Report Contents
- **File Analysis Summary**: Overview of all analyzed files
- **PCAP Analysis**: Detailed network traffic analysis including:
  - Packet counts and protocol distributions
  - Traffic summaries and suspicious activity detection
  - Top communication flows in formatted tables
  - AI-powered cybersecurity insights
- **Memory Forensics**: Volatility analysis results
- **Document Analysis**: Password cracking results and content analysis
- **Professional Formatting**: Tables, headers, and structured sections

### How to Generate Reports
1. Upload and analyze files through the web interface
2. Type "generate a report" in the chat
3. Download the generated .docx file from your Downloads folder

## Configuration

Update paths in `server.js` for external tools:
- `volatilityDir`: Path to Volatility3 installation
- `johnDir`: Path to John the Ripper installation
- `rockyouPath`: Path to wordlist file

## License

ISC

