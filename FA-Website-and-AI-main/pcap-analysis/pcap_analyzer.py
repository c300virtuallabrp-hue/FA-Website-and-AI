#!/usr/bin/env python3
"""
PCAP/PCAPng Network Traffic Analyzer
Based on NetNerve implementation using Scapy
"""

import sys
import json
import os

try:
    from scapy.all import rdpcap, IP, TCP, UDP, ICMP, ARP
    from collections import defaultdict
    import socket
except ImportError as e:
    print(json.dumps({"error": f"Missing required packages: {e}. Please install with: pip install scapy"}))
    sys.exit(1)

class CustomJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle non-serializable objects"""
    def default(self, obj):
        if hasattr(obj, '__str__'):
            return str(obj)
        if hasattr(obj, '__int__'):
            return int(obj)
        if hasattr(obj, '__float__'):
            return float(obj)
        return super().default(obj)

def extract_packet_data(file_path):
    """Extract packet data from PCAP file similar to NetNerve"""
    try:
        packets = rdpcap(file_path)
        data = []
        protocols = set()

        for pkt in packets:
            pkt_info = {}

            if IP in pkt:
                pkt_info["src_ip"] = pkt[IP].src
                pkt_info["dst_ip"] = pkt[IP].dst
                pkt_info["packet_len"] = int(len(pkt))  # Convert to int
                pkt_info["timestamp"] = float(pkt.time)  # Convert to float

                if TCP in pkt:
                    pkt_info["protocol"] = "TCP"
                    pkt_info["src_port"] = int(pkt[TCP].sport)  # Convert to int
                    pkt_info["dst_port"] = int(pkt[TCP].dport)  # Convert to int
                    pkt_info["flags"] = str(pkt[TCP].flags)
                    protocols.add("TCP")

                elif UDP in pkt:
                    pkt_info["protocol"] = "UDP"
                    pkt_info["src_port"] = int(pkt[UDP].sport)  # Convert to int
                    pkt_info["dst_port"] = int(pkt[UDP].dport)  # Convert to int
                    protocols.add("UDP")

                elif ICMP in pkt:
                    pkt_info["protocol"] = "ICMP"
                    protocols.add("ICMP")

            elif ARP in pkt:
                pkt_info["protocol"] = "ARP"
                protocols.add("ARP")

            # Only add packet info if we have meaningful data
            if pkt_info:
                data.append(pkt_info)

        # Calculate total data size
        total_data_size = sum(pkt.get('packet_len', 0) for pkt in data)

        return {
            "protocols": list(protocols),
            "packet_data": data,
            "total_data_size": int(total_data_size),  # Convert to int
            "packet_count": len(data)
        }

    except Exception as e:
        return {
            "error": f"Failed to analyze PCAP file: {str(e)}",
            "protocols": [],
            "packet_data": [],
            "total_data_size": 0,
            "packet_count": 0
        }

def analyze_traffic_patterns(packet_data):
    """Analyze traffic patterns for suspicious activity"""
    analysis = {
        "total_packets": len(packet_data),
        "unique_ips": set(),
        "port_scans": [],
        "suspicious_ports": [],
        "protocol_distribution": {},
        "traffic_summary": ""
    }

    # Common suspicious ports
    suspicious_ports = {
        21: "FTP",
        22: "SSH",
        23: "Telnet",
        25: "SMTP",
        53: "DNS",
        80: "HTTP",
        110: "POP3",
        143: "IMAP",
        443: "HTTPS",
        993: "IMAPS",
        995: "POP3S",
        3306: "MySQL",
        3389: "RDP",
        5900: "VNC"
    }

    for pkt in packet_data:
        src_ip = pkt.get('src_ip')
        dst_ip = pkt.get('dst_ip')
        protocol = pkt.get('protocol')
        src_port = pkt.get('src_port')
        dst_port = pkt.get('dst_port')

        if src_ip:
            analysis["unique_ips"].add(src_ip)
        if dst_ip:
            analysis["unique_ips"].add(dst_ip)

        if protocol:
            if protocol not in analysis["protocol_distribution"]:
                analysis["protocol_distribution"][protocol] = 0
            analysis["protocol_distribution"][protocol] += 1

        # Check for suspicious ports
        for port in [src_port, dst_port]:
            if port and port in suspicious_ports:
                analysis["suspicious_ports"].append({
                    "port": int(port),  # Ensure it's an int
                    "service": suspicious_ports[port],
                    "packet": pkt
                })

    analysis["unique_ips"] = list(analysis["unique_ips"])

    # Generate traffic summary
    analysis["traffic_summary"] = f"""
Network Traffic Analysis Summary:
- Total Packets: {analysis['total_packets']}
- Unique IP Addresses: {len(analysis['unique_ips'])}
- Protocols Used: {', '.join(analysis['protocol_distribution'].keys())}
- Suspicious Ports Detected: {len(analysis['suspicious_ports'])}
"""

    return analysis

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python pcap_analyzer.py <pcap_file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    # Extract packet data
    result = extract_packet_data(file_path)

    if "error" in result:
        print(json.dumps(result))
        sys.exit(1)

    # Add traffic analysis
    traffic_analysis = analyze_traffic_patterns(result["packet_data"])
    result["traffic_analysis"] = traffic_analysis

    # Output JSON result
    print(json.dumps(result, indent=2, cls=CustomJSONEncoder))

if __name__ == "__main__":
    main()