require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');

const VT_API_KEY = process.env.VT_API_KEY;
const VT_API_BASE = 'https://www.virustotal.com/api/v3';

if (!VT_API_KEY) {
    console.warn('⚠️  VT_API_KEY not set in .env file');
}

/**
 * Compute SHA256 hash of a file
 */
function getFileHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
        console.error('Error computing file hash:', error.message);
        return null;
    }
}

/**
 * Check if VirusTotal already has a report for this file (by hash)
 * This is cheaper and faster than uploading
 */
async function checkFileByHash(fileHash) {
    try {
        if (!VT_API_KEY || !fileHash) {
            return null;
        }

        const response = await axios.get(
            `${VT_API_BASE}/files/${fileHash}`,
            {
                headers: {
                    'x-apikey': VT_API_KEY
                }
            }
        );

        console.log(`[VirusTotal] File already scanned: ${fileHash}`);
        return response.data.data;
    } catch (error) {
        // 404 means file not found in VT database - this is expected for new files
        if (error.response?.status === 404) {
            console.log(`[VirusTotal] File not in database, will upload: ${fileHash}`);
            return null;
        }
        console.error('Error checking file hash:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Upload file to VirusTotal using stream (memory efficient)
 */
async function uploadFileToVirusTotal(filePath, filename) {
    try {
        if (!VT_API_KEY) {
            console.warn('VirusTotal API key not configured');
            return null;
        }

        const form = new FormData();
        const fileStream = fs.createReadStream(filePath);
        
        form.append('file', fileStream, { filename: filename });

        console.log(`[VirusTotal] Uploading file: ${filename}`);

        const response = await axios.post(
            `${VT_API_BASE}/files`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                    'x-apikey': VT_API_KEY
                }
            }
        );

        const analysisId = response.data.data.id;
        console.log(`[VirusTotal] Upload successful. Analysis ID: ${analysisId}`);
        return analysisId;
    } catch (error) {
        console.error('VirusTotal upload error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Get analysis results from VirusTotal
 * Note: Use analysis ID from upload, not file hash
 */
async function getAnalysisResult(analysisId) {
    try {
        if (!VT_API_KEY || !analysisId) {
            return null;
        }

        const response = await axios.get(
            `${VT_API_BASE}/analyses/${analysisId}`,
            {
                headers: {
                    'x-apikey': VT_API_KEY
                }
            }
        );

        console.log(`[VirusTotal] Results retrieved for analysis: ${analysisId}`);
        return response.data.data;
    } catch (error) {
        console.error('Error retrieving analysis results:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Extract key info from VirusTotal scan result
 */
function extractScanInfo(analysisData) {
    if (!analysisData) return null;

    const attributes = analysisData.attributes || {};
    
    // VirusTotal uses 'last_analysis_stats' for the detection counts
    const stats = attributes.last_analysis_stats || attributes.stats || {};
    const results = attributes.last_analysis_results || attributes.results || {};

    return {
        status: attributes.status || 'completed',
        lastAnalysisDate: attributes.last_analysis_date,
        stats: {
            malicious: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            undetected: stats.undetected || 0,
            harmless: stats.harmless || 0,
            timeout: stats.timeout || 0
        },
        detectionSummary: `Malicious: ${stats.malicious || 0}, Suspicious: ${stats.suspicious || 0}, Undetected: ${stats.undetected || 0}, Harmless: ${stats.harmless || 0}`,
        results: results,
        sha256: attributes.sha256,
        md5: attributes.md5,
        sha1: attributes.sha1,
        size: attributes.size
    };
}

/**
 * Main scan function: Check hash first, then upload if needed
 */
async function scanFileWithVirusTotal(filePath, filename) {
    try {
        // Step 1: Compute file hash
        const fileHash = getFileHash(filePath);
        if (!fileHash) {
            return { success: false, error: 'Failed to compute file hash' };
        }

        console.log(`[VirusTotal] File hash: ${fileHash}`);

        // Step 2: Check if VT already has this file (cheaper!)
        let existingResult = await checkFileByHash(fileHash);
        if (existingResult) {
            const scanInfo = extractScanInfo(existingResult);
            return {
                success: true,
                fromCache: true,
                analysisId: existingResult.id,
                data: scanInfo
            };
        }

        // Step 3: File not in VT, upload it
        const analysisId = await uploadFileToVirusTotal(filePath, filename);
        if (!analysisId) {
            return { success: false, error: 'Failed to upload file to VirusTotal' };
        }

        // Step 4: Wait for VirusTotal to process (they need time)
        console.log('[VirusTotal] Waiting 15 seconds for scan to complete...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Step 5: Get results
        const analysisResult = await getAnalysisResult(analysisId);
        if (!analysisResult) {
            return { success: false, error: 'Failed to retrieve analysis results' };
        }

        const scanInfo = extractScanInfo(analysisResult);
        return {
            success: true,
            fromCache: false,
            analysisId: analysisId,
            data: scanInfo
        };
    } catch (error) {
        console.error('[VirusTotal] Scan error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    scanFileWithVirusTotal,
    getAnalysisResult,
    getFileHash,
    checkFileByHash,
    uploadFileToVirusTotal,
    extractScanInfo
};
