// Google Sheets Integration for Lead Import
// Using Replit's Google Sheets connector

import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// Get Google Drive client for listing spreadsheets
export async function getGoogleDriveClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// List available spreadsheets from the user's drive
export async function listSpreadsheets() {
  const drive = await getGoogleDriveClient();
  
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name)',
    orderBy: 'modifiedTime desc',
    pageSize: 50
  });

  return response.data.files || [];
}

// Get sheet names from a spreadsheet
export async function getSheetNames(spreadsheetId: string) {
  const sheets = await getUncachableGoogleSheetClient();
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title'
  });

  return response.data.sheets?.map(sheet => sheet.properties?.title || 'Sheet1') || ['Sheet1'];
}

// Read data from a specific sheet
export async function readSheetData(spreadsheetId: string, sheetName: string, range?: string) {
  const sheets = await getUncachableGoogleSheetClient();
  
  const fullRange = range ? `${sheetName}!${range}` : sheetName;
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange
  });

  return response.data.values || [];
}

// Parse lead data from sheet rows
export interface ParsedLead {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address?: string;
  source?: string;
  notes?: string;
}

export function parseLeadsFromSheetData(
  rows: any[][],
  columnMapping: Record<string, number>,
  skipHeader: boolean = true
): ParsedLead[] {
  const leads: ParsedLead[] = [];
  const startRow = skipHeader ? 1 : 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const lead: ParsedLead = {
      companyName: columnMapping.companyName !== undefined ? (row[columnMapping.companyName] || '').trim() : '',
      contactPerson: columnMapping.contactPerson !== undefined ? (row[columnMapping.contactPerson] || '').trim() : '',
      email: columnMapping.email !== undefined ? (row[columnMapping.email] || '').trim() : '',
      phone: columnMapping.phone !== undefined ? (row[columnMapping.phone] || '').trim() : '',
      address: columnMapping.address !== undefined ? (row[columnMapping.address] || '').trim() : undefined,
      source: columnMapping.source !== undefined ? (row[columnMapping.source] || '').trim() : 'Google Sheet Import',
      notes: columnMapping.notes !== undefined ? (row[columnMapping.notes] || '').trim() : undefined
    };

    // Only add if at least company name or contact person exists
    if (lead.companyName || lead.contactPerson) {
      leads.push(lead);
    }
  }

  return leads;
}
