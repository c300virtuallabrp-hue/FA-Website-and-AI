# 🧪 FYP Virtual Lab  
### Advanced File Analysis Chatbot with Automated Forensic Report Generation

A **digital forensics virtual lab** that supports **multi‑file forensic analysis** using AI-assisted insights and generates **professional Word (.docx) forensic reports**.

---

## ✨ Key Features

### 📁 Supported File Types
- **PCAP / PCAPng** – Network traffic analysis with AI-powered cybersecurity insights (Groq)
- **Memory Dumps** – Memory forensics using Volatility 3
- **Office Documents** – DOCX, XLSX, PPTX, PDF with password cracking
- **Data Files** – CSV AI-based analysis
- **Text Files** – Logs and text content analysis
- **PNG Images** – Image content and steganography analysis

---

### 🔍 Analysis Capabilities
- **Network Traffic Analysis**
- **Memory Forensics** using Volatility 3
- **Password Cracking** with John the Ripper
- **AI-Powered Insights** (Groq)
- **Professional Report Generation** (.docx)

---

## 📦 Installation & Setup

Refer to this README for full setup instructions, environment configuration, Flowise AI integration, and startup steps.

## Prerequisites

### Required Software

1. **Install Python version 3.8+**
   - Download from: https://www.python.org/downloads/windows/

2. **Install Node.js (Windows MSI)**
   - Download from: https://nodejs.org/en/download

3. **Install rockyou.txt**
   - Download from: https://weakpass.com/wordlists/rockyou.txt
   - Select rockyou.txt.gz
   - Use 7Zip to extract the folder

4. **Install scapy**
   - Execute `pip install scapy` on PowerShell

5. **Download Volatility Symbol Table**
   - Download from: https://downloads.volatilityfoundation.org/volatility3/symbols/windows.zip

6. **Install virtual lab from GitHub**
   - Extract the ZIP file
   - Download from: https://github.com/c300virtuallabrp-hue/FA-Website-and-AI

7. **Convert Mans file, raw file, split image into .csv files**
   - Use Redline, MFT, autopsy
   - Follow the technical guide provided in the word Document

---

## Setup

### Step 1: Move Folders to C:\ Drive

After downloading the Virtual Lab from the Github page, there should be 2 folders and 1 bat file.

Move the 2 folders to `C:\` drive.

### Step 2: Move rockyou.txt

Move the downloaded `rockyou.txt` file to `C:\FYP_Virtual_lab\`.

### Step 3: Move windows.zip

Move the `windows.zip` file to `C:\FYP_Virtual_lab\volatility3-develop\volatility3-develop\volatility3\symbols`.

### Step 4: Create .env Files

Go into your favourite Code Editor (like VSC or WebStorm) and add 2 `.env` files into both subfolders `FA-Website-and-AI-main` and `FYP_Virtual_lab`.

#### Setup FA-Website-and-AI-main .env

Create the `.env` file with the following content:

```env
# Place your Groq API key below
GROQ_API_KEY=your_api_key_here
FLOWISE_API_URL=your_flowise_url_here
```

Replace `your_api_key_here` with your actual Groq API key.

#### How to Create a Groq API Key

1. **Visit the Groq Cloud Console**
   - Go to: https://console.groq.com

2. **Sign Up or Log In**
   - If you don't have an account, click "Sign Up" and register using:
     - Google
     - GitHub
     - Email
     - SSO (Single Sign-On)
   - If you already have an account, click "Log In"

3. **Access the Developer Menu**
   - On the top right of the dashboard, click the hamburger menu (☰)
   - Select "Developers" from the dropdown

4. **Navigate to the API Keys Section**
   - Inside the Developers area, find the "API Keys" tab
   - Click on it to manage your keys

5. **Create a New API Key**
   - Click the "Create API Key" button
   - A modal will appear asking for a name or description for the key
   - Choose a recognizable name (e.g., "My Llama Integration") and confirm

6. **Copy and Store Your API Key Securely**
   - Once generated, copy the key and store it in a secure location
   - You'll need this key to authenticate requests to Groq's API

#### Setup FYP_Virtual_lab .env

Create the `.env` file with the following content:

```env
# VirusTotal API Configuration
VT_API_KEY=99e5dc14a1bc116a0b077a55114588975f3e9a8c32175791e210a0bf65a88dcf

# Server Configuration
PORT=3001
NODE_ENV=development

# Flowise Configuration
FLOWISE_API_URL=your_flowise_url_here
```

**NOTE:** It must be in the exact same folder as `chatbot.js`, else it will not work.

---

## Flowise AI Setup

### Step 1: Create Flowise Account

Setup Flowise AI yourself. If you do not have a Flowise Account, you may register via this link: https://cloud.flowiseai.com/register

### Step 2: Import Agent Flows

Copy the AI FLOWISE JSON from each of the subfolders, then import it to your Flowise Account's Agent Flows:

1. Click on **+Add New**
2. Inside the canvas, click on **settings**
3. Then **load agents**
4. Find the AI JSON file
5. Press **Open**

### Step 3: Configure API Credentials

1. On the AI Agent, click on it
2. Go to the **model node**
3. Go to **parameters** and connect the credentials
4. Select the **Groq API Key**
   - If not created, under "Connect Credential", click on **-Create New-**
   - Fill up the name and the API key (you may use the same API as the one in the .env folder you have created)

### Step 4: Save Your Work

Remember to save your work until you see the success message.

### Step 5: Get API Endpoint

1. Go to **API endpoints**
2. Click on **Javascript**
3. Copy only the API link (the link will be unique to your setup)
4. Copy the link, then replace the link inside the 2 `.env` files

---

## Starting the Virtual Lab

To start the Virtual Lab servers, execute the `startup.bat` file.

- 2 instances of CMD will open
- **DO NOT CLOSE THESE** as doing so will shut down the servers
- The servers are online when both CMD instances show:
  - "Server is running at http://localhost:3000"
  - "Server is running at http://localhost:3001"
- This may take several minutes

---

## 📜 License
ISC
