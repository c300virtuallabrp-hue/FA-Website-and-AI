# Virtual Digital Forensics Lab - GitHub Pages

A modern, professional, static website showcasing an AI-powered Virtual Digital Forensics Lab with an integrated chatbot interface. Designed specifically for diploma students and lecturers in digital forensics education.

## Features

### 🎯 Core Functionality
- **Single Page Application**: All content on one responsive home page
- **AI Chatbot Interface**: ChatGPT-like interface for forensic investigations
- **File Upload Support**: 
  - Text files (.txt, .log, .csv)
  - Images (.png, .jpg, .jpeg, .gif, .bmp)
  - Documents (.pdf, .docx)
  - Archives (.zip)
- **Knowledge Base**: Comprehensive forensic education content
- **Timeline Analysis**: Discussion of forensic investigation methodologies
- **Real-time Interaction**: Dynamic chat with typing indicators

### 🎨 Design Features
- **Cybersecurity-Inspired Theme**: Dark theme with accent colors (neon green, cyan, pink)
- **Professional Layout**: 
  - Header with branded logo
  - Chat interface with evidence analysis area
  - Information panel with tips and resources
  - Footer with educational context
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Accessibility**: Reduced motion support, semantic HTML, WCAG compliance
- **Modern UI Elements**:
  - Smooth animations and transitions
  - Gradient effects
  - Custom scrollbars
  - Interactive buttons and indicators

### 📚 Educational Content
The chatbot includes comprehensive knowledge on:
- Digital Forensics Fundamentals
- Chain of Custody Procedures
- File System Analysis (NTFS, FAT32, ext4)
- Memory Forensics & Volatile Data
- Log Analysis & Event Logs
- File Metadata Analysis
- Encryption & Hashing
- Network Forensics
- Malware Analysis
- Investigation Process & Procedures
- Cloud Forensics
- Mobile Device Forensics
- Deleted File Recovery & Data Carving
- Digital Artifacts & Browser History
- Windows Registry Analysis

## Project Structure

```
c300-project/
├── index.html              # Main HTML page
├── assets/
│   ├── css/
│   │   └── styles.css     # All styling (responsive, cybersecurity theme)
│   └── js/
│       └── chatbot.js     # Chatbot logic and knowledge base
├── .gitignore             # GitHub Pages configuration
└── README.md              # Documentation
```

## Technical Stack

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS variables and Grid/Flexbox
- **Vanilla JavaScript**: ES6+ with async/await for file processing
- **JSZip Library**: Client-side ZIP file extraction and analysis
- **Font Awesome 6**: Icon library
- **Flowise AI**: Cloud-based agent workflow for evidence analysis
- **GitHub Pages**: Automatic deployment

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Usage

### For Students
1. Open the lab and explore the chatbot interface
2. Ask questions about digital forensics
3. Upload sample evidence files for analysis
4. Learn investigation procedures and best practices
5. Use quick-start buttons for common topics

### For Lecturers
1. Reference materials for teaching
2. Demonstrate forensic concepts through examples
3. Create sample evidence scenarios
4. Assign investigation questions
5. Use as supplementary educational resource

## Getting Started Locally

1. Clone or download the repository:
```bash
git clone https://github.com/yourusername/c300-project.git
cd c300-project
```

2. Open with a local server (required for file uploads):
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (with http-server)
npx http-server
```

3. Open `http://localhost:8000` in your browser

## Deployment to GitHub Pages

1. Create a GitHub repository named `c300-project`
2. Push the project files:
```bash
git init
git add .
git commit -m "Initial commit: Virtual Digital Forensics Lab"
git branch -M main
git remote add origin https://github.com/yourusername/c300-project.git
git push -u origin main
```

3. Enable GitHub Pages in repository settings:
   - Settings → Pages
   - Select "main" branch as source
   - Site will be live at `https://yourusername.github.io/c300-project`

## Features in Detail

### Chat Interface
- **Message Input**: Multi-line textarea with auto-resize
- **Send Message**: Keyboard shortcut (Shift+Enter) or button click
- **Message Display**: User and bot messages with distinct styling
- **Typing Indicator**: Animated dots showing bot is processing
- **Welcome Screen**: Quick-start buttons for common topics
- **Inline File Cards**: ChatGPT-style file cards with:
  - File icon and name
  - ZIP Archive type label
  - Processing status with color indicators
  - Remove button with X icon
  - Visual feedback (green border + background tint on success)

### File Upload System
- **ZIP File Processing**: Advanced asynchronous ZIP file extraction
- **File Metadata Collection**: Automatically extracts:
  - Filename and path within ZIP
  - File type and extension mapping
  - File size in bytes
  - MIME type detection
  - Text preview (first 500 chars for .txt, .csv, .json, .xml, .md, .html, .log files)
- **Visual Processing Feedback**: 
  - Real-time "Processing ZIP file..." status in file card
  - Green success state with file count: "All X files uploaded successfully"
  - Colored border (green for success, red for error)
  - Background tint for visual confirmation
- **Race Condition Prevention**: Blocks form submission during ZIP processing to ensure metadata is fully loaded
- **File Removal**: Easy removal with automatic state cleanup
- **Auto Type Detection**: Comprehensive mapping for forensic file types:
  - Packet captures (.pcapng, .pcap)
  - Memory dumps (.mem, .dmp, .vmem)
  - Microsoft Office (.xlsx, .docx, .pptx)
  - Forensic images (.e01, .aff, .raw, .dd)
  - Archives (.zip, .rar, .7z)
  - And 30+ more forensic-relevant formats
- **Developer Tools**: Console logging for debugging ZIP extraction process
- **Report Generation**: Flexible natural language triggers
  - Keywords: "generate", "create", "make", "build", "produce"
  - Examples: "generate a report", "make me a report", "create report"
  - Automatic text report fallback when Word document generation unavailable
  - Single user message display (duplicate prevention)

### Information Panel
- **Tips**: How to use the platform effectively
- **Supported Files**: List of accepted file types
- **For Students & Lecturers**: Educational focus and context
- **Responsive**: Adapts to screen size

### Forensic Knowledge Base
- **Comprehensive Coverage**: 13 major forensic topics
- **Practical Information**: Tools, techniques, and best practices
- **Investigation Guidance**: Detailed procedures and methodologies
- **Real-world Scenarios**: Practical application examples

## Customization

### Change Color Scheme
Edit CSS variables in `styles.css`:
```css
:root {
    --accent-primary: #00ff88;      /* Neon green */
    --accent-secondary: #ff006e;    /* Pink */
    --accent-tertiary: #00d4ff;     /* Cyan */
    /* ... other colors ... */
}
```

### Add More Knowledge
Extend the `knowledgeBase` object in `chatbot.js`:
```javascript
'your-topic': {
    keywords: ['keyword1', 'keyword2'],
    response: `Your detailed response...`
}
```

### Modify Styling
All styles are in `assets/css/styles.css` using:
- CSS Grid and Flexbox for layout
- CSS Variables for consistency
- Media queries for responsiveness
- Animations for visual feedback

## Performance

- **Lightweight**: No frameworks or heavy dependencies
- **Fast Loading**: Minimal CSS and JS
- **Responsive Images**: No external image dependencies
- **Optimized**: Icon font (Font Awesome) via CDN

## Accessibility Features

- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Color contrast compliance
- Reduced motion support
- Screen reader friendly

## Educational License

This project is provided for educational purposes in digital forensics training and diploma programs. It serves as both a learning resource and a practical tool for students and educators.

## Support & Contributions

For issues, suggestions, or contributions:
1. Create an issue in the GitHub repository
2. Submit pull requests for improvements
3. Provide feedback on content accuracy

## Recent Updates (December 2025)

### Version 1.4 - Client-Side Word Document Generation (December 18, 2025)
- ✅ **Word Document Generation**: Full client-side .docx report generation using docx library v7.8.2
- ✅ **Browser-Based Reports**: Word documents created directly in browser without server dependencies
- ✅ **Automatic Download**: Generated reports download automatically as `.docx` files
- ✅ **Professional Formatting**: Reports include:
  - Title with heading levels (H1, H2, H3)
  - Timestamp of generation
  - Files in Evidence section with file details
  - Detailed Analysis section (when available from LLM)
  - Bullet points for file listings
- ✅ **Dynamic Library Loading**: Fallback mechanism loads docx library if missing on page load
- ✅ **Analysis Integration**: Incorporates LLM analysis results from Flowise iteration workflow
- ✅ **Evidence Summary**: Includes comprehensive file metadata in reports
- ✅ **Error Handling**: Graceful fallback with detailed error messages
- ✅ **CDN Integration**: Uses unpkg.com CDN for docx library (v7.8.2)
- ✅ **Library Detection**: Smart detection of docx global variable with multiple fallbacks

### Version 1.3 - Advanced Flowise Agent Workflow
- ✅ **Metadata Extraction**: Full file metadata collection from ZIP archives (size, MIME, preview)
- ✅ **Flowise Cloud Integration**: Multi-node agent workflow for intelligent evidence analysis
- ✅ **Custom State Transfer Node**: "Zipfile Metadata Node" bridges API vars to flow state for iteration
- ✅ **Iteration Processing**: File-by-file analysis loop through uploaded evidence
- ✅ **Microsoft File Detection**: Conditional routing for Office documents (Word, Excel, PowerPoint)
- ✅ **Document Parsing**: Custom function extracts file information from metadata
- ✅ **LLM Analysis**: Google Gemini 2.5 Pro analyzes extracted document content
- ✅ **Flexible Report Triggers**: Natural language support - "generate", "create", "make me", "build", "produce" + "report"
- ✅ **Visual Feedback**: Real-time processing status with color-coded success/error states
- ✅ **Race Condition Fix**: Prevents premature submission during async ZIP processing
- ✅ **Duplicate Message Prevention**: Single user message display for report requests
- ✅ **Developer Logging**: Comprehensive console output for debugging ([QUERY], [UNZIP], [REPORT] prefixes)
- ✅ **MIME Type Detection**: 60+ forensic file format MIME type mappings
- ✅ **Text Previews**: Automatic preview extraction for text-based evidence files (500 char limit)
- ✅ **Client-Side Fallback**: Text report generation when server-side processing unavailable

### Flowise Agent Workflow Architecture

#### Node Flow
```
Start → File Agent → Zipfile Metadata Node → File Iterations →
  ├─→ Condition: Is Microsoft File? →
  │   ├─→ YES: Microsoft Parser → LLM Analysis Node
  │   └─→ NO: (skip)
  └─→ Word Document Report Generator → Output
```

#### Node Details

**1. Start Node**
- Initializes agentflow with ephemeral memory
- Defines state keys: `zipFileNames`, `zipFileMetadata`

**2. File Agent** (Groq llama-3.1-8b-instant)
- Receives arrays via `$vars.zipFileNames` and `$vars.zipFileMetadata`
- Temperature: 0.0, Max Tokens: 512
- Returns assistant message with structured JSON evidence summary

**3. Zipfile Metadata Node** (Custom Function)
- **Critical Bridge**: Transfers `$vars.zipFileMetadata` to `$flow.state.zipFileMetadata`
- JavaScript: `const metadata = $vars.zipFileMetadata || []; return metadata;`
- Update Flow State: Key=`zipFileMetadata`, Value=`{{ output }}`
- Enables iteration node to access client-sent arrays

**4. File Iterations** (Iteration Node)
- Array Input: `$flow.state.zipFileMetadata`
- Loops through each file metadata object
- Current item accessible via `$items` variable

**5. Condition Node: "Is it a Microsoft File"**
- Checks: `$items.mime` against Office document MIME types
- Regex: `^application\/(vnd\.ms-(excel|powerpoint|word)|vnd\.openxmlformats-officedocument\.(spreadsheetml|presentationml|wordprocessingml)\.document)$`
- Routes Microsoft files to parser, others skip

**6. Microsoft Files Parser Node** (Custom Function)
- Libraries: mammoth (Word), XLSX (Excel), pptx-parser (PowerPoint)
- Extracts raw text from document buffers
- Updates flow state with `parsed_text`

**7. Microsoft File Analyse Node** (Google Gemini 2.5 Pro)
- Temperature: 0.6, Max Tokens: 510
- Prompt: Analyzes extracted text for summary, key points, action items
- Streaming: Enabled

**8. Word Document Report Generator** (Custom Function)
- Returns evidence summary and analysis results as JSON
- Client-side docx library (v7.8.2) generates Word document in browser
- Automatic download of formatted .docx report

### API Integration Details

**Frontend to Flowise:**
```javascript
payload = {
  question: "Unzip this",
  overrideConfig: {
    vars: {
      zipFileNames: ["file1.xlsx", "file2.docx"],
      zipFileMetadata: [
        {
          filename: "file1.xlsx",
          path: "Evidence/file1.xlsx",
          type: "Microsoft Excel",
          sizeBytes: 27136,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          preview: null
        }
      ]
    }
  }
}
```

**Flowise Response:**
```javascript
{
  message: {
    content: "{\"evidenceSummary\": [{\"filename\":..., \"type\":..., \"contents\":...}], \"analysisResults\": [\"analysis text...\"]}"
  }
}
```

### Word Document Generation

**Client-Side Process:**
1. Frontend calls Flowise API with "generate report" intent
2. Flowise returns `evidenceSummary` and `analysisResults` in JSON
3. Browser loads docx library (v7.8.2) from CDN if not already loaded
4. JavaScript creates Document with sections:
   - Title: "Evidence Analysis Report" (Heading 1)
   - Generation timestamp (Heading 2)
   - "Files in Evidence" section with bullet points (Heading 2, 3)
   - "Detailed Analysis" section with LLM results (Heading 2)
5. `Packer.toBlob()` generates binary .docx file
6. Browser triggers automatic download as `Evidence_Report.docx`

**Libraries Used:**
- `docx` v7.8.2 from unpkg.com CDN
- Browser APIs: `Blob`, `URL.createObjectURL`, `document.createElement`

### Metadata Object Schema
Each file in `zipFileMetadata` contains:
- `filename` (string): Name of the file
- `path` (string): Full path within ZIP archive
- `type` (string): Human-readable file type (e.g., "Microsoft Excel")
- `sizeBytes` (number): File size in bytes
- `mime` (string): MIME type for content identification
- `preview` (string|null): First 500 characters for text files, null for binary files

### Console Logging Prefixes
- `[QUERY]`: Flowise API request/response debugging
- `[UNZIP]`: ZIP extraction and metadata collection
- `[REPORT]`: Report generation status
- `📄`, `✅`, `❌`: Visual status indicators in console

## Future Enhancements

- Multi-language support
- Export conversation transcripts
- Integration with additional forensic tools APIs
- Video tutorials and demonstrations
- Interactive scenarios and case studies
- Certification tracking for students
- Advanced analytics for educators
- Real-time file content analysis (beyond metadata)

## Disclaimer

This is an educational platform. For actual forensic investigations:
- Follow proper legal procedures
- Maintain chain of custody
- Consult with legal experts
- Use validated forensic tools
- Follow industry standards (NIST, SANS, IACIS)

---

**Version**: 1.4  
**Last Updated**: 18th December 2025  
**Created for**: Digital Forensics Education (Diploma Level)  
**Key Technologies**: JSZip, Flowise Cloud, Groq LLM (llama-3.1-8b-instant), Google Gemini 2.5 Pro, docx (client-side v7.8.2)
