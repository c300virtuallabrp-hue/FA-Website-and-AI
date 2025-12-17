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

### Version 1.2 - Enhanced File Processing
- ✅ **Metadata Extraction**: Full file metadata collection from ZIP archives (size, MIME, preview)
- ✅ **Flowise Integration**: Connected to Groq LLM via Flowise Cloud for intelligent evidence analysis
- ✅ **Visual Feedback**: Real-time processing status with color-coded success/error states
- ✅ **Race Condition Fix**: Prevents premature submission during async ZIP processing
- ✅ **Developer Logging**: Comprehensive console output for debugging file extraction
- ✅ **MIME Type Detection**: 30+ forensic file format MIME type mappings
- ✅ **Text Previews**: Automatic preview extraction for text-based evidence files

### Flowise Agent Configuration
The File Agent now receives and processes:
- `zipFileNames`: Array of extracted filenames
- `zipFileMetadata`: Array of metadata objects containing:
  - `filename`: Name of the file
  - `path`: Full path within ZIP
  - `type`: Human-readable file type
  - `sizeBytes`: File size in bytes
  - `mime`: MIME type string
  - `preview`: First 500 characters (for text files)

Agent outputs structured JSON with evidence summary including metadata for each file.

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

**Version**: 1.2  
**Last Updated**: 17th December 2025  
**Created for**: Digital Forensics Education (Diploma Level)  
**Key Technologies**: JSZip, Flowise AI, Groq LLM (llama-3.1-8b-instant)
