// =====================================================
// VIRTUAL DIGITAL FORENSICS LAB - CHATBOT ENGINE
// AI-Powered Investigation Assistant
// =====================================================

class ForensicsLabChatbot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.fileInput = document.getElementById('fileInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileList = document.getElementById('fileList');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        this.uploadedFiles = [];
        this.conversationHistory = [];
        this.isWaitingForResponse = false;
        
        // Knowledge base for forensics
        this.knowledgeBase = this.initializeKnowledgeBase();
        
        this.initializeEventListeners();
        this.setupAutoResize();
    }

    // =====================================================
    // EVENT LISTENERS
    // =====================================================

    initializeEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && event.shiftKey) {
            this.sendMessage();
            event.preventDefault();
        }
    }

    setupAutoResize() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }

    // =====================================================
    // FILE HANDLING
    // =====================================================

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            // Validate file size (max 25MB)
            if (file.size > 25 * 1024 * 1024) {
                this.showNotification(`File ${file.name} exceeds 25MB limit`, 'error');
                return;
            }

            // Check if file already exists
            if (!this.uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.uploadedFiles.push(file);
                this.renderFileList();
            }
        });

        // Reset file input
        event.target.value = '';
    }

    renderFileList() {
        this.fileList.innerHTML = '';
        
        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <i class="fas fa-${this.getFileIcon(file.type)}"></i>
                <span title="${file.name}">${file.name}</span>
                <button type="button" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            fileItem.querySelector('button').addEventListener('click', () => {
                this.uploadedFiles.splice(index, 1);
                this.renderFileList();
            });

            this.fileList.appendChild(fileItem);
        });
    }

    getFileIcon(fileType) {
        if (!fileType) return 'file';
        if (fileType.includes('image')) return 'image';
        if (fileType.includes('zip') || fileType.includes('archive')) return 'file-archive';
        if (fileType.includes('pdf')) return 'file-pdf';
        if (fileType.includes('text') || fileType.includes('csv')) return 'file-alt';
        if (fileType.includes('word') || fileType.includes('document')) return 'file-word';
        return 'file';
    }

    // =====================================================
    // MESSAGE SENDING & PROCESSING
    // =====================================================

    async sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message && this.uploadedFiles.length === 0) {
            return;
        }

        // Disable send button
        this.sendBtn.disabled = true;
        this.isWaitingForResponse = true;
        this.updateStatus('processing');

        try {
            // Add user message to chat
            this.addMessage(message || 'Analyzing uploaded files...', 'user');

            // Process files if any
            let fileInfo = '';
            if (this.uploadedFiles.length > 0) {
                fileInfo = await this.processFiles();
            }

            // Clear input
            this.messageInput.value = '';
            this.messageInput.style.height = 'auto';
            this.uploadedFiles = [];
            this.renderFileList();

            // Show typing indicator
            this.showTypingIndicator();

            // Get response from knowledge base
            setTimeout(() => {
                const response = this.generateResponse(message, fileInfo);
                this.removeTypingIndicator();
                this.addMessage(response, 'bot');
                
                this.conversationHistory.push({
                    user: message,
                    bot: response,
                    files: this.uploadedFiles.length > 0,
                    timestamp: new Date()
                });

                this.isWaitingForResponse = false;
                this.updateStatus('ready');
                this.sendBtn.disabled = false;
                this.scrollToBottom();
            }, 800 + Math.random() * 1200);

        } catch (error) {
            console.error('Error processing message:', error);
            this.addMessage('⚠️ Error processing your request. Please try again.', 'bot');
            this.isWaitingForResponse = false;
            this.updateStatus('error');
            this.sendBtn.disabled = false;
        }
    }

    async processFiles() {
        let fileInfo = '\n\n**Files Analyzed:**\n';

        for (const file of this.uploadedFiles) {
            try {
                const content = await this.readFile(file);
                fileInfo += `- ${file.name} (${(file.size / 1024).toFixed(2)} KB): `;

                if (file.type.includes('image')) {
                    fileInfo += 'Image file ready for metadata analysis\n';
                } else if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
                    fileInfo += 'Archive detected - contains multiple evidence files\n';
                } else if (file.type.includes('text') || file.type === '') {
                    const lines = content.split('\n').length;
                    fileInfo += `Text file (${lines} lines of potential evidence)\n`;
                } else {
                    fileInfo += 'File ready for analysis\n';
                }
            } catch (error) {
                fileInfo += `Error reading file\n`;
            }
        }

        return fileInfo;
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result || '');
            };
            
            reader.onerror = (e) => {
                reject(new Error('Failed to read file'));
            };

            // For images, just read metadata
            if (file.type.includes('image')) {
                resolve(`Image: ${file.name}`);
            } else {
                reader.readAsText(file);
            }
        });
    }

    // =====================================================
    // KNOWLEDGE BASE & RESPONSES
    // =====================================================

    initializeKnowledgeBase() {
        return {
            // Digital Forensics Basics
            'digital forensics|forensic|investigation': {
                keywords: ['digital forensics', 'forensic investigation', 'what is forensics'],
                response: `**Digital Forensics Overview**

Digital forensics is the process of uncovering and interpreting electronic data for investigative purposes. Key aspects include:

**Main Types:**
1. **Computer Forensics** - Hard drives, operating systems, file systems
2. **Mobile Forensics** - Smartphones, tablets, extraction of data
3. **Network Forensics** - Network traffic analysis, packet capture
4. **Cloud Forensics** - Data in cloud environments
5. **Database Forensics** - Database records and logs

**Key Principles:**
• Preserve evidence integrity
• Maintain chain of custody
• Document all procedures
• Use validated tools
• Follow legal requirements

**Common Tools:**
- EnCase, FTK for disk imaging
- Volatility for memory analysis
- Wireshark for network traffic
- Cellebrite for mobile devices
- Splunk for log analysis

The goal is to recover, preserve, and analyze evidence while maintaining its admissibility in court.`
            },

            'chain of custody|evidence handling|evidence preservation': {
                keywords: ['chain of custody', 'evidence handling', 'preserve'],
                response: `**Chain of Custody Best Practices**

The chain of custody is critical for maintaining evidence integrity and legal admissibility.

**Essential Steps:**

1. **Initial Collection**
   - Document everything before touching evidence
   - Take photographs from multiple angles
   - Record exact location and conditions

2. **Documentation**
   - Unique identifier for each piece of evidence
   - Date, time, location of collection
   - Collector's name and signature
   - Detailed description

3. **Handling**
   - Minimize direct contact with evidence
   - Use appropriate protection (gloves, anti-static)
   - Store in secure, controlled environment
   - Maintain consistent temperature/humidity

4. **Transfer**
   - Document every transfer with time/date
   - Signature of both giving and receiving parties
   - Reason for transfer
   - Condition of evidence seals

5. **Storage**
   - Locked, access-controlled facility
   - Environmental controls
   - Regular inventory checks
   - Separate secure areas for different evidence types

**Common Mistakes to Avoid:**
- Breaking evidence seals without documentation
- Allowing unauthorized personnel access
- Incomplete handoff documentation
- Poor environmental storage conditions
- Mixing different evidence types

A broken chain of custody can render evidence inadmissible in court.`
            },

            'file system|ntfs|fat32|ext4|inode': {
                keywords: ['file system', 'ntfs', 'fat32', 'ext4', 'inode', 'filesystem'],
                response: `**File System Analysis in Digital Forensics**

Understanding file systems is crucial for evidence recovery and analysis.

**Common File Systems:**

**NTFS (New Technology File System)**
- Primary Windows file system
- Supports large files and volumes
- Master File Table (MFT) stores metadata
- Journal transactions for recovery
- Alternative Data Streams (ADS) for hidden data

**FAT32 (File Allocation Table)**
- Legacy Windows system
- Minimal metadata
- No built-in journaling
- Data recovery is simpler
- Limited to 4GB files

**ext4 (Fourth Extended File System)**
- Standard Linux file system
- Inode structure for file metadata
- Journal for crash recovery
- Extent-based allocation
- Timestamps stored in nanoseconds

**Key Forensic Artifacts:**
- **MFT** (NTFS): Contains all file metadata
- **Inodes** (ext4/Linux): File information structure
- **Journaling**: Logs of file system changes
- **Free Space**: Deleted file recovery
- **Slack Space**: Unallocated space within clusters
- **Timestamps**: MAC times (Modified, Accessed, Created)

**Evidence Recovery:**
- Unallocated clusters may contain deleted files
- Carving for file headers/footers
- Metadata analysis for timeline creation
- Slack space analysis for hidden data

**Tools for Analysis:**
- FTK, EnCase for comprehensive analysis
- Autopsy for file system examination
- Log2timeline for timeline generation`
            },

            'memory forensics|volatile|ram|volatility': {
                keywords: ['memory forensics', 'volatile', 'ram', 'volatility'],
                response: `**Memory Forensics & Volatile Data**

RAM contains valuable evidence that's lost when a system powers off.

**Why Memory Forensics Matters:**
- Active processes and running programs
- Open files and network connections
- Encryption keys and cached credentials
- Malware in execution
- User activity and clipboard contents
- Network connections and browser history

**Memory Acquisition:**
- **Live Capture**: While system is running
  - Preserves volatile state
  - May alert malware
  - Tools: DumpIt, Belkasoft Live RAM Capturer
  
- **Hibernation File**: Captures memory to disk
  - Less intrusive
  - May be encrypted
  
- **Crash Dump**: From system crash
  - May be incomplete
  - Automatic on some systems

**Analysis with Volatility:**
- Open-source memory analysis framework
- Plugins for various Windows/Linux versions
- Extract processes, DLLs, network connections
- Identify hidden/rootkit processes
- Recover password hashes
- Timeline analysis

**Key Artifacts to Examine:**
- Running processes (pslist)
- Loaded DLLs and modules
- Network connections and sockets
- Kernel handles and objects
- Cached data and files
- Windows registry in memory

**Best Practices:**
- Acquire memory immediately
- Document all acquisitions
- Use write-blocking devices
- Maintain chain of custody
- Validate acquired image integrity`
            },

            'log analysis|event logs|windows event viewer|syslog': {
                keywords: ['log analysis', 'event logs', 'windows event', 'syslog', 'logs'],
                response: `**Log Analysis for Digital Forensics**

Logs provide a detailed timeline of system and user activities.

**Windows Event Logs:**
- **System**: OS events, drivers, services
- **Security**: Authentication, access, auditing
- **Application**: Software events and errors
- **PowerShell**: Script execution history
- **Sysmon**: Advanced system activity logging

**Key Event IDs to Monitor:**
- 4624: Successful login
- 4625: Failed login
- 4688: Process creation
- 4689: Process termination
- 4698: Scheduled task creation
- 4720: User account created
- 5140: Network share access

**Linux/Unix Logs:**
- **/var/log/auth.log**: Authentication events
- **/var/log/syslog**: System messages
- **/var/log/apache2/access.log**: Web server access
- **/var/log/secure**: Security events (RedHat)

**Analysis Techniques:**
1. **Timeline Creation**: Chronological event sequence
2. **Correlation**: Link events across log types
3. **Anomaly Detection**: Identify unusual patterns
4. **Keyword Searching**: Find relevant entries
5. **Log Aggregation**: Combine multiple sources

**Tools for Log Analysis:**
- Splunk: Log aggregation and analysis
- ELK Stack: Elasticsearch, Logstash, Kibana
- Log2timeline: Automatic timeline generation
- Winevt_kb: Windows event log parsing
- Lnk Parser: Windows shortcut file analysis

**Common Investigations:**
- Track user logons and activity
- Identify unauthorized access attempts
- Monitor file access and modifications
- Track process execution chains
- Detect privilege escalation
- Monitor scheduled task changes

**Challenges:**
- Log rotation and deletion
- False positives/negatives
- Timezone inconsistencies
- Incomplete data
- Purposeful log tampering`
            },

            'metadata|exif|timestamps|mac times': {
                keywords: ['metadata', 'exif', 'timestamp', 'mac time', 'created modified accessed'],
                response: `**File Metadata Analysis**

Metadata provides crucial timestamps and system information about files.

**File Metadata Types:**

**MAC Times (NTFS/ext4):**
- **Modified (M)**: Last content change
- **Accessed (A)**: Last file read
- **Changed (C)**: Last metadata change
- **Birth (B)**: File creation (NTFS only)

**Image EXIF Data:**
- Camera model and settings
- GPS coordinates (if available)
- Date/time photograph taken
- Thumbnail information
- Can be manipulated or removed

**Document Metadata:**
- Author and company
- Creation and modification times
- Software used
- Revision history
- Comments and tracked changes

**Timeline Significance:**
- Establishes when activities occurred
- Identifies files of interest
- Detects timestamp manipulation
- Correlates multiple files
- Proves user activity

**Analysis Techniques:**
1. **Timeline Generation**
   - Extract all MAC times
   - Create chronological sequence
   - Identify clusters of activity
   - Look for patterns

2. **Timestamp Validation**
   - Compare multiple sources
   - Check for inconsistencies
   - Identify manipulation
   - Validate against artifacts

3. **Suspicious Indicators**
   - Future-dated files
   - Modified during investigation
   - Timestamps older than OS installation
   - Unusual clustering

**Tools:**
- Exiftool: Extract and modify metadata
- Log2timeline: Automatic timeline generation
- FTK/EnCase: Metadata analysis
- Autopsy: File metadata examination
- Winosy: Windows EXIF/metadata viewer

**Privacy Considerations:**
- Image metadata may reveal location
- Document metadata shows collaborators
- Browser history metadata shows browsing patterns
- Be aware of privacy implications`
            },

            'encryption|encrypted files|passwords|hash': {
                keywords: ['encryption', 'encrypted', 'password', 'hash', 'cipher'],
                response: `**Encryption & Hashing in Forensics**

Encryption protects data, but forensic techniques can still recover information.

**Encryption Types:**

**Full Disk Encryption:**
- BitLocker (Windows)
- FileVault 2 (macOS)
- LUKS (Linux)
- VeraCrypt (cross-platform)

**File-Level Encryption:**
- Password-protected archives
- Encrypted files (EFS, NTFS)
- Document encryption (Office, PDF)
- Cloud storage encryption

**Hash Functions (One-Way):**
- MD5, SHA-1, SHA-256, SHA-512
- Used for: password hashing, file integrity
- Cannot be reversed (ideally)
- Identify duplicate files

**Forensic Approaches:**

1. **Find Encryption Keys:**
   - Memory analysis (running processes)
   - Registry examination
   - Configuration files
   - Temporary files
   - Cache/browser storage

2. **Dictionary/Brute Force Attacks:**
   - Offline password cracking
   - GPU acceleration
   - Rainbow tables
   - Wordlists and rules

3. **Plaintext Recovery:**
   - Unencrypted copies
   - System restore/backup
   - Cloud backups
   - Email attachments

4. **Metadata Analysis:**
   - File names and sizes
   - Creation timestamps
   - File system artifacts
   - Communication patterns

**Tools:**
- Hashcat: GPU password cracking
- John the Ripper: Password cracking
- VeraCrypt: Test encrypted containers
- EnCase/FTK: Encryption detection
- Volatility: Memory key extraction

**Legal Considerations:**
- Key escrow laws (some countries)
- Compelling disclosure (legal debates)
- Incident response vs. law enforcement
- Jurisdiction-specific regulations

**Best Practices:**
- Always attempt to find/acquire keys
- Document encryption method
- Note any unencrypted portions
- Preserve potential recovery options
- Consider legal consultation`
            },

            'network forensics|pcap|wireshark|traffic analysis': {
                keywords: ['network forensics', 'pcap', 'wireshark', 'traffic', 'network'],
                response: `**Network Forensics & Traffic Analysis**

Network capture files provide detailed communication evidence.

**Capture File Formats:**
- **PCAP**: Standard packet capture format
- **PCAPNG**: Extended format with metadata
- **PCAP-over-IP**: Remote capture capability

**Key Protocols to Analyze:**
- **HTTP/HTTPS**: Web traffic
- **DNS**: Domain resolution
- **SMTP/IMAP/POP3**: Email
- **FTP**: File transfer
- **SSH/Telnet**: Remote access
- **SMB**: File sharing

**Important Artifacts:**
- Source/destination IP addresses
- MAC addresses and ARP tables
- DNS queries and responses
- SSL/TLS certificates and keys
- HTTP headers and cookies
- Email headers and content
- File transfers

**Wireshark Analysis:**
- Apply filters for specific traffic
- Follow TCP/UDP streams
- Extract files from streams
- Generate statistics
- Identify suspicious patterns
- Reassemble fragmented packets

**Investigation Techniques:**

1. **Connection Tracking**
   - Establish communication timeline
   - Identify external contacts
   - Track data exfiltration
   - Detect C&C communications

2. **Protocol Analysis**
   - Decode encrypted traffic (if keys available)
   - Analyze handshakes
   - Identify protocol anomalies
   - Detect suspicious patterns

3. **Pattern Recognition**
   - Unusual bandwidth usage
   - DDoS attack patterns
   - Data exfiltration signatures
   - Malware beacon patterns

**Tools:**
- Wireshark: Interactive packet analysis
- tcpdump: Command-line capture
- Suricata: IDS and threat detection
- Zeek: Network intelligence
- NetworkMiner: PCAP analysis
- Tshark: Command-line Wireshark

**Challenges:**
- Encrypted traffic (TLS/SSL)
- Traffic fragmentation
- VPN tunneling
- Massive data volume
- Session reconstruction
- Privacy considerations

**Best Practices:**
- Capture at strategic points
- Preserve original PCAP files
- Document capture methodology
- Maintain chain of custody
- Use multiple analysis tools`
            },

            'malware analysis|virus|trojan|ransomware': {
                keywords: ['malware', 'virus', 'trojan', 'ransomware', 'malicious'],
                response: `**Malware Analysis in Digital Forensics**

Malware investigation requires careful isolation and analysis.

**Types of Malware:**
- **Viruses**: Self-replicating, require host
- **Worms**: Self-propagating, no host needed
- **Trojans**: Disguised malicious software
- **Ransomware**: Encrypts data, demands payment
- **Spyware**: Covert surveillance
- **Rootkits**: Kernel-level persistence
- **Botnets**: Remote-controlled malware networks

**Detection Methods:**

1. **Signature-Based**
   - Known malware hashes
   - Antivirus/endpoint detection
   - Yara rules
   - Hash comparison

2. **Behavioral Analysis**
   - Suspicious process behavior
   - Network connections
   - File system modifications
   - Registry changes

3. **Heuristic Analysis**
   - Packed executables
   - Code injection
   - Process spawning chains
   - Memory modification

**Analysis Approaches:**

**Static Analysis (Safe):**
- File hash identification
- PE header examination
- String extraction
- Import table analysis
- Packing detection

**Dynamic Analysis (Dangerous):**
- Execute in sandbox (isolated)
- Monitor system activity
- Capture network traffic
- Record file/registry changes
- Analyze memory state

**Tools:**
- **Static**: PEiD, ExifTool, Yara
- **Dynamic**: Cuckoo Sandbox, Wireshark
- **Memory**: Volatility, Process Hacker
- **Network**: Wireshark, tcpdump
- **Decompilers**: IDA Pro, Ghidra, x64dbg

**Investigation Steps:**
1. Isolate infected system
2. Acquire memory and disk images
3. Identify malware files/processes
4. Analyze behavioral indicators
5. Determine infection method
6. Track lateral movement
7. Assess data compromise

**Ransomware Specifics:**
- Identify encryption method
- Search for key generation/storage
- Check backups availability
- Analyze ransom notes
- Correlate with known families
- Report to authorities

**Safety Precautions:**
- Use isolated, air-gapped systems
- Virtual machine for dynamic analysis
- Network isolation during testing
- Personal protective equipment mindset
- Never execute unknown files casually`
            },

            'timeline|investigation process|evidence collection': {
                keywords: ['timeline', 'investigation', 'process', 'collection', 'procedure'],
                response: `**Digital Forensics Investigation Process**

A systematic approach ensures reliable evidence and legal admissibility.

**Phase 1: Preparation**
- Assemble forensic toolkit
- Verify tool functionality
- Prepare write-blocking devices
- Create baseline system images
- Document equipment details
- Establish chain of custody procedures

**Phase 2: Collection**
- Acquire volatile data (memory, live system)
- Create forensic images of storage
- Use write-blocking devices
- Hash for integrity verification
- Document scene and evidence
- Photograph equipment and connections
- Take detailed notes

**Phase 3: Preservation**
- Store in secure location
- Maintain appropriate conditions
- Seal and label containers
- Document all access
- Create backup copies
- Protect from contamination
- Maintain chain of custody

**Phase 4: Analysis**
- Examine file systems
- Recover deleted files
- Analyze metadata
- Generate timelines
- Identify artifacts of interest
- Cross-reference evidence
- Document findings thoroughly

**Phase 5: Interpretation**
- Reconstruct events
- Identify perpetrators/victims
- Establish timeline of activity
- Connect digital to physical evidence
- Prepare for presentation
- Consider alternative explanations

**Phase 6: Reporting**
- Write comprehensive report
- Use neutral language
- Include detailed findings
- Provide exhibits/evidence
- State qualifications
- Prepare expert testimony
- Maintain documentation

**Key Principles:**
✓ Document everything
✓ Minimize modifications
✓ Maintain chain of custody
✓ Be thorough and systematic
✓ Remain objective
✓ Use validated tools
✓ Follow legal requirements
✓ Stay current with techniques

**Evidence Timeline Creation:**
1. Extract timestamps from all sources
2. Organize chronologically
3. Include all events
4. Identify timeline gaps
5. Cross-validate information
6. Present clearly
7. Support with evidence

**Common Mistakes:**
✗ Incomplete documentation
✗ Breaking chain of custody
✗ Bias toward theory
✗ Tool limitations not disclosed
✗ Missing data sources
✗ Poor timeline organization
✗ Inadequate report detail

**Professional Standards:**
- NIST Cybersecurity Framework
- SANS Forensics Whitepaper
- ACE Certification standards
- IACIS guidelines
- ISO/IEC 27037 (Guidelines for Collection)
- ISO/IEC 27041 (Guidelines for Analysis)`
            },

            'cloud forensics|aws|azure|google cloud': {
                keywords: ['cloud', 'aws', 'azure', 'google cloud', 'cloud forensics'],
                response: `**Cloud Forensics & Remote Systems**

Cloud environments present unique forensic challenges and opportunities.

**Cloud Service Models:**

**IaaS (Infrastructure as a Service):**
- Virtual machines and storage
- User controls OS and applications
- Provider controls infrastructure
- Examples: AWS EC2, Azure VMs, Google Compute

**PaaS (Platform as a Service):**
- Applications and databases
- Provider manages infrastructure
- Limited forensic access
- Examples: Salesforce, Heroku

**SaaS (Software as a Service):**
- Web applications (Office 365, Gmail)
- Minimal direct access
- Reliant on provider cooperation
- Legal/regulatory requirements

**Forensic Challenges:**
- Multi-tenant environments
- Geographic data distribution
- Limited access to infrastructure
- Encryption by default
- Data retention policies
- Jurisdiction and privacy laws
- Limited logging visibility

**Collection Methods:**

1. **Native Tools:**
   - AWS CloudTrail for activity logging
   - Azure Monitor and Activity Log
   - Google Cloud Logging
   - Bucket/storage snapshots

2. **API Access:**
   - Query cloud resources
   - Extract configuration
   - Retrieve historical data
   - Automated collection

3. **Legal Process:**
   - Subpoena to provider
   - Emergency disclosures
   - Mutual Legal Assistance Treaties (MLAT)
   - Data preservation notices

**Key Artifacts:**
- Access logs and activity trails
- Virtual machine snapshots
- Database transaction logs
- API request logs
- IAM activity and permissions
- Network flow logs
- Configuration changes

**Analysis Considerations:**
- Timestamps in different timezones
- Distributed processing
- Container orchestration
- Serverless functions
- Multi-region replication
- Audit log retention limitations

**Tools & Services:**
- CloudTrail Logging (AWS)
- Azure Activity Log
- Google Cloud Audit Logs
- Splunk Cloud
- Datadog for monitoring
- Custom scripts via APIs

**Best Practices:**
- Enable logging immediately
- Set appropriate retention policies
- Establish preservation procedures
- Document cloud architecture
- Understand shared responsibility
- Test recovery procedures
- Maintain documentation

**Legal/Compliance:**
- GDPR data handling
- CCPA privacy rights
- Industry regulations (HIPAA, PCI)
- Cross-border data issues
- Data residency requirements
- Provider compliance certifications

**Incident Response:**
1. Identify affected systems
2. Preserve evidence
3. Isolate compromised resources
4. Collect logs immediately
5. Snapshot instances
6. Query databases
7. Contact provider for assistance
8. Follow legal procedures`
            },

            'mobile forensics|iphone|android|ios': {
                keywords: ['mobile forensics', 'iphone', 'android', 'ios', 'smartphone'],
                response: `**Mobile Device Forensics**

Smartphones contain crucial evidence but require special handling.

**Device Types & Challenges:**

**iOS (iPhone/iPad):**
- Hardware encryption enabled by default
- Requires passcode or Face ID bypass
- Cloud backup considerations (iCloud)
- App sandboxing limits access
- Frequent OS updates
- Biometric security

**Android:**
- More varied manufacturers
- Fragmented OS versions
- Manufacturer customizations
- More accessible filesystem
- Google account integration
- Varying security levels

**Key Data Sources:**
- Call logs and SMS messages
- Contact information
- Photos and videos
- App data and messages
- Location history
- Web browsing history
- Email accounts
- Calendar events
- GPS coordinates

**Acquisition Methods:**

1. **Physical Acquisition:**
   - Direct NAND dump
   - Requires specialized equipment
   - Full device extraction
   - May require boot mode access

2. **Logical Acquisition:**
   - File system extraction
   - Requires device unlock
   - Limited to accessible data
   - Tools: Cellebrite, Oxygen Forensics

3. **Cloud Backup:**
   - iCloud (Apple)
   - Google Drive/Google Account
   - Samsung Cloud
   - OneDrive
   - Often unencrypted or accessible

4. **Live Data:**
   - Connected to computer
   - Access to locked portions
   - Screen capture and interaction
   - Requires consent or warrant

**Analysis Areas:**

**Communications:**
- SMS/MMS messages
- WhatsApp, Facebook Messenger
- Email accounts
- Viber, Telegram, Signal
- Social media direct messages

**Location Data:**
- GPS history
- Google Timeline
- Maps history
- Location services logs
- Tower information

**Multimedia:**
- Photo EXIF data
- Video metadata
- Deleted recovery
- Hidden folders

**Apps & Data:**
- App-specific artifacts
- Authentication tokens
- Cached data
- App permissions
- Installation history

**Tools:**
- Cellebrite UFED: Comprehensive extraction
- Oxygen Forensics: Data acquisition
- MOBILedit: Device analysis
- Android Debug Bridge (adb): Command-line access
- Autopsy: Analysis platform

**Challenges:**
- Encryption and biometric locks
- Cloud integration
- Frequent OS updates
- App-specific encryption
- Data deletion methods
- Anti-forensics techniques
- Legal access limitations

**Best Practices:**
- Acquire as soon as possible
- Maintain chain of custody
- Document everything
- Use write-blocking equipment
- Preserve original device
- Create backup images
- Document legal authorization
- Stay current with techniques

**Legal Considerations:**
- Warrant requirements
- Cross-border device access
- Apple/Google cooperation policies
- Privacy laws and regulations
- Consent vs. compulsion
- Evidence admissibility requirements`
            },

            'deleted files|recovery|unallocated space|carving': {
                keywords: ['deleted files', 'recovery', 'unallocated', 'carving', 'deleted data'],
                response: `**Deleted File Recovery & Data Carving**

Deleted data often remains recoverable through forensic techniques.

**Why Deleted Files Survive:**
- File entries removed from directory
- Data blocks marked as available
- Data remains until overwritten
- Slack space may contain fragments
- Journal/log entries may reference

**Recovery Methods:**

**Method 1: Filesystem Analysis**
- Examine file system structures
- Locate inode/directory entries
- Recover pointers to data blocks
- Reconstruct file metadata
- Higher recovery success rates
- Tools: Autopsy, FTK, EnCase

**Method 2: File Carving**
- Search for file signatures (magic bytes)
- Identify file headers and footers
- Extract contiguous data chunks
- Works without filesystem help
- Lower success with fragmented files
- Tools: Foremost, PhotoRec, Scalpel

**Common File Signatures:**
- JPEG: FF D8 FF
- PNG: 89 50 4E 47
- PDF: 25 50 44 46
- ZIP: 50 4B 03 04
- MS Office: D0 CF 11 E0
- HTML: 3C 21 44 4F 43 54

**Challenges:**
- Overwritten data is unrecoverable
- Fragmented files difficult to reconstruct
- Encrypted files unrecoverable without key
- Multiple partitions complicate search
- Time-intensive process
- Storage capacity affects search time

**Best Practices:**
1. **Immediate Acquisition:**
   - Prevent further writes
   - Limit system use
   - Remove storage media

2. **Preserve Original:**
   - Create forensic image
   - Verify with hash
   - Store safely
   - Analyze copy only

3. **Document Process:**
   - Record exact commands
   - Note recovery rates
   - Document found files
   - Maintain integrity verification

4. **Validate Results:**
   - Verify file integrity
   - Check file headers
   - Review recovered content
   - Confirm relevance

**Timeline Considerations:**
- Deleted times vs. last modified
- Recovery time (when deleted)
- Other file activity around deletion
- Patterns of file deletion
- Suspicious timing

**Anti-Forensics:**
- Secure deletion tools
- Multiple overwrites
- Drive encryption
- Shredding programs
- Wiping tools (eraser, BleachBit)

**Counter Anti-Forensics:**
- Memory analysis (recovery tools active)
- Log analysis (deletion activity)
- Timeline analysis (activity patterns)
- Browser history (download/access)
- Slack space analysis

**Common Recoveries:**
- Documents (Word, Excel, PDF)
- Images (deleted photos, screenshots)
- Emails and attachments
- Log files
- Database records
- Temporary files
- Cache files

**Success Factors:**
- Time since deletion
- Storage usage level
- File fragmentation
- Storage type (SSD vs. HDD)
- User activity post-deletion
- Encryption status
- Filesystem type`
            },

            'artifact analysis|browser history|registry': {
                keywords: ['artifact', 'browser history', 'registry', 'artifacts'],
                response: `**Digital Artifacts & User Activity Analysis**

User artifacts provide detailed evidence of activities and intentions.

**Browser Artifacts:**

**Internet Explorer/Edge:**
- History: %LocalAppData%\\Microsoft\\Windows\\History
- Cookies: %LocalAppData%\\Microsoft\\Windows\\Cookies
- Cache: %LocalAppData%\\Microsoft\\Windows\\Temporary Internet Files
- WebCacheV01.dat database

**Chrome/Chromium:**
- History database: Default/History
- Bookmarks JSON file
- Cookies SQLite database
- Cache in Default/Cache_Data
- Preferences JSON file

**Firefox:**
- History in places.sqlite
- Downloads database
- Cookies sqlite database
- Cache in profile/cache2
- Localstore.rdf bookmarks

**Safari (macOS):**
- History in ~/Library/Safari/
- Bookmarks.plist
- TopSites database
- Cache in ~/Library/Safari/History.db

**Windows Registry Artifacts:**

**User Activity:**
- HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RecentDocs
- HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache
- HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\TypedPaths

**Services & Connections:**
- HKLM\\System\\ControlSet\\Services (running services)
- HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\MountPoints2 (USB devices)
- HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\ComDlg32\\LastVisitedPidlMRU

**Program Execution:**
- HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\RunMRU
- HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths
- Prefetch files: C:\\Windows\\Prefetch

**System Information:**
- OS Installation time
- Last shutdown time
- System timezone
- User accounts
- Network configuration

**Application Artifacts:**

**Office Documents:**
- Recent files list
- Temporary backup files (~$)
- Recently used documents
- AutoRecovery files
- Metadata (author, timestamps)

**Email:**
- Local mailbox storage
- Message index files
- Attachments folder
- Account configuration
- Sent/Deleted items

**Chat/Messaging:**
- Application databases
- Conversation logs
- User contact lists
- Profile pictures
- Settings and preferences

**Timeline Artifacts:**
- File access logs
- Application logs
- System event logs
- Browser download history
- Document modification times

**Analysis Tools:**
- Registry Editor: Windows registry view
- MiTeC REGEDIT: Registry parser
- Hayabusa: Windows eventlog search tool
- WinPrefetchView: Prefetch analysis
- Log2timeline: Timeline generation
- Volatility: Memory artifact analysis

**Investigation Workflow:**

1. **Identify Relevant Artifacts:**
   - Browser usage
   - Document creation
   - Communication
   - File access
   - Program execution

2. **Extract Artifacts:**
   - Parse registry hives
   - Extract database records
   - Recover deleted entries
   - Collect log files

3. **Timeline Creation:**
   - Consolidate timestamps
   - Identify activity clusters
   - Correlate events
   - Visualize patterns

4. **Interpretation:**
   - Establish user actions
   - Identify intentional behavior
   - Detect suspicious activity
   - Connect to investigation

**Privacy Considerations:**
- Legitimate vs. incidental data
- User consent for collection
- Data minimization principles
- Retention policies
- Anonymization possibilities

**Admissibility Requirements:**
- Documented methodology
- Tool reliability
- Accuracy verification
- Proper chain of custody
- Expert qualification
- Clear presentation`
            }
        };
    }

    generateResponse(userMessage, fileInfo) {
        const message = userMessage.toLowerCase();

        // Search for matching knowledge base entries
        for (const topic in this.knowledgeBase) {
            const entry = this.knowledgeBase[topic];
            const keywords = entry.keywords;

            for (const keyword of keywords) {
                if (message.includes(keyword)) {
                    let response = entry.response;
                    if (fileInfo) {
                        response += fileInfo;
                    }
                    return response;
                }
            }
        }

        // Default response if no match found
        return this.generateDefaultResponse(userMessage, fileInfo);
    }

    generateDefaultResponse(userMessage, fileInfo) {
        const responses = [
            `I understand you're asking about: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"\n\nWhile I don't have a specific response in my knowledge base, here are some related resources:\n\n**Suggested Topics:**\n- Digital Forensics Fundamentals\n- File System Analysis\n- Memory Forensics\n- Network Analysis\n- Evidence Chain of Custody\n- Timeline Analysis\n- Log File Investigation\n\nPlease feel free to:\n1. Upload evidence files for analysis\n2. Ask specific forensics questions\n3. Request information about investigation procedures\n4. Inquire about tools and methodologies`,

            `That's an interesting question about forensic investigation. To provide more detailed guidance, I'd recommend:\n\n**Next Steps:**\n- Specify your investigation focus\n- Share relevant evidence files (if applicable)\n- Describe your current challenge\n- Clarify the system or device type\n\n**I can assist with:**\n📋 Evidence analysis and interpretation\n🔍 Forensic methodology guidance\n🛠️ Tool recommendations and usage\n⏱️ Timeline generation and analysis\n📄 Documentation and reporting\n🎓 Educational resources for digital forensics`,

            `Great question! For a more comprehensive answer, consider providing:\n\n**Additional Information:**\n- Specific forensic aspect you're investigating\n- Device/system type (Windows, Linux, iOS, Android, etc.)\n- File evidence for analysis\n- Your expertise level\n- Specific challenge or scenario\n\n**Popular Topics I Cover:**\n→ Chain of custody procedures\n→ Deleted file recovery\n→ Memory and volatile data analysis\n→ Browser artifact investigation\n→ Log file analysis and timeline creation\n→ Mobile device forensics\n→ Malware identification and analysis`
        ];

        let response = responses[Math.floor(Math.random() * responses.length)];
        if (fileInfo) {
            response += '\n' + fileInfo;
        }
        return response;
    }

    // =====================================================
    // UI MANAGEMENT
    // =====================================================

    addMessage(content, sender) {
        const message = document.createElement('div');
        message.className = `message ${sender}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = sender === 'user' ? '👤' : '🔍';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;

        message.appendChild(avatar);
        message.appendChild(messageContent);

        this.chatMessages.appendChild(message);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">🔍</div>
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateStatus(status) {
        const statusMap = {
            'ready': '🟢 Ready for investigation',
            'processing': '🟠 Processing...',
            'error': '🔴 Error occurred'
        };
        
        const statusElement = this.statusIndicator.parentElement.querySelector('.status-text');
        if (statusElement) {
            statusElement.textContent = statusMap[status] || statusMap['ready'];
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Can be enhanced with toast notifications
    }
}

// =====================================================
// QUICK MESSAGE HANDLER
// =====================================================

function addQuickMessage(message) {
    const input = document.getElementById('messageInput');
    input.value = message;
    input.focus();
    const chatbot = window.chatbot;
    if (chatbot) {
        setTimeout(() => chatbot.sendMessage(), 100);
    }
}

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ForensicsLabChatbot();
    console.log('🔍 Virtual Digital Forensics Lab initialized');
    console.log('Welcome to the forensics investigation platform!');
});
