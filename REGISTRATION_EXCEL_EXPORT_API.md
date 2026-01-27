# Registration Report Excel Export API

## Overview
This API generates a comprehensive Excel report combining vendor, farmer, and customer registration data for specified employees.

---

## Endpoint

```
GET /registration-report/export/excel
```

### Query Parameters
- `employeeIds` (required): Employee IDs (can be single or multiple repeated parameters)

---

## Example Requests

### Single Employee
```bash
GET /registration-report/export/excel?employeeIds=emp123
```

### Multiple Employees
```bash
GET /registration-report/export/excel?employeeIds=emp1&employeeIds=emp2&employeeIds=emp3
```

### cURL Example
```bash
curl -X GET "http://localhost:3000/registration-report/export/excel?employeeIds=emp1&employeeIds=emp2" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output registration_report.xlsx
```

---

## Response

The API returns an Excel file (.xlsx) for download with the following structure:

### File Structure

The Excel workbook contains **4 worksheets**:

1. **Summary** - Overview of all registrations
2. **Vendors** - Detailed vendor registration data
3. **Farmers** - Detailed farmer registration data
4. **Customers** - Detailed customer registration data

---

## Worksheet Details

### 1. Summary Sheet

**Columns:**
- Employee Name
- Vendors (count)
- Farmers (count)
- Customers (count)
- Total Registrations
- Active (total)
- Dormant (total)
- Pending (total)

**Features:**
- Aggregated data across all registration types
- Color-coded header (Blue theme)
- Alternating row colors for readability
- Frozen header row

---

### 2. Vendors Sheet

**Columns:**
- Employee Name
- Till Last Month
- Last Month
- Active
- Dormant
- Pending
- Rejected
- Total

**Features:**
- Green color theme
- Detailed vendor registration metrics
- Status breakdown (Active/Dormant/Pending/Rejected)

---

### 3. Farmers Sheet

**Columns:**
- Employee Name
- Till Last Month
- Last Month
- Active
- Dormant
- Pending
- Rejected
- Total

**Features:**
- Orange color theme
- Detailed farmer registration metrics
- Status breakdown (Active/Dormant/Pending/Rejected)

---

### 4. Customers Sheet

**Columns:**
- Employee Name
- Till Last Month
- Last Month
- Active
- Dormant
- Pending
- Rejected
- Total

**Features:**
- Blue color theme
- Detailed customer registration metrics
- Status breakdown (Active/Dormant/Pending/Rejected)

---

## Data Definitions

### Till Last Month
Total registrations created up to the end of last month

### Last Month
Registrations created during the last month only

### Active
Registrations that have associated transactions (GRN for vendors/farmers, DC for customers) in the last month

### Dormant
Registrations created in the last month but with no transactions

### Pending
Registrations awaiting approval

### Rejected
Registrations that were rejected

### Total
Sum of approved registrations (Till Last Month + Pending)

---

## File Details

### File Name Format
```
Registration_Report_YYYY-MM-DD.xlsx
```

Example: `Registration_Report_2026-01-22.xlsx`

### File Storage
Files are saved to: `reports/registration/`

**Dual Approach**:
1. File is saved to server at `reports/registration/Registration_Report_YYYY-MM-DD.xlsx`
2. File buffer is also sent directly to client for immediate download

### Response Type
The API returns the Excel file as a **buffer** (binary data) directly in the HTTP response.

- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename="Registration_Report_YYYY-MM-DD.xlsx"`
- **Server Storage**: File is also saved to `reports/registration/` for backup/audit purposes

### File Size
Typical file size: 15-50 KB depending on data volume

---

## JavaScript/TypeScript Examples

### Using Axios

```typescript
import axios from 'axios';

async function downloadRegistrationReport(employeeIds: string[]) {
  try {
    const response = await axios.get('/registration-report/export/excel', {
      params: {
        employeeIds: employeeIds
      },
      responseType: 'blob', // Important for file download
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'registration_report.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Error downloading report:', error);
  }
}

// Usage
downloadRegistrationReport(['emp1', 'emp2', 'emp3']);
```

### Using Fetch

```typescript
async function downloadRegistrationReport(employeeIds: string[]) {
  const params = new URLSearchParams();
  employeeIds.forEach(id => params.append('employeeIds', id));

  try {
    const response = await fetch(
      `/registration-report/export/excel?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download report');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'registration_report.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Error downloading report:', error);
  }
}
```

### React Component Example

```typescript
import React, { useState } from 'react';
import axios from 'axios';

function RegistrationReportDownload() {
  const [loading, setLoading] = useState(false);
  const [employeeIds, setEmployeeIds] = useState(['emp1', 'emp2']);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/registration-report/export/excel', {
        params: { employeeIds },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registration_report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to download report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleDownload} disabled={loading}>
        {loading ? 'Generating...' : 'Download Registration Report'}
      </button>
    </div>
  );
}
```

---

## Error Responses

### Missing employeeIds
```json
{
  "message": "employeeIds is required as query parameter"
}
```
**Status Code:** 400

### Empty employeeIds
```json
{
  "message": "At least one valid employeeId is required"
}
```
**Status Code:** 400

### Server Error
```json
{
  "message": "Internal server error"
}
```
**Status Code:** 500

---

## Excel Styling Features

### Color Themes
- **Summary Sheet**: Blue (#1F4E78)
- **Vendors Sheet**: Green (#28A745)
- **Farmers Sheet**: Orange (#FF9800)
- **Customers Sheet**: Blue (#2196F3)

### Formatting
- ✅ Bold headers with white text
- ✅ Alternating row colors (white/light gray)
- ✅ Cell borders for all data
- ✅ Frozen header rows
- ✅ Auto-sized columns
- ✅ Center-aligned data
- ✅ Professional styling

---

## Use Cases

### 1. Monthly Reports
Generate monthly registration reports for management review

### 2. Performance Analysis
Analyze employee performance in registering vendors, farmers, and customers

### 3. Data Export
Export registration data for external analysis or archival

### 4. Audit Trail
Maintain records of registration activities

### 5. Team Comparison
Compare registration performance across team members

---

## Best Practices

### 1. Limit Employee Count
For better performance, limit to 20-30 employees per request

### 2. Schedule Generation
For large datasets, consider scheduling report generation during off-peak hours

### 3. File Management
Implement automatic cleanup of old report files to prevent disk space issues:

```typescript
// Clean up files older than 30 days
const fs = require('fs');
const path = require('path');

function cleanupOldReports() {
  const reportsDir = path.join(process.cwd(), 'reports', 'registration');
  
  if (!fs.existsSync(reportsDir)) {
    return;
  }
  
  const files = fs.readdirSync(reportsDir);
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  files.forEach(file => {
    const filePath = path.join(reportsDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      console.log('Deleted old report:', file);
    }
  });
}

// Run cleanup daily
setInterval(cleanupOldReports, 24 * 60 * 60 * 1000);
```

### 4. Error Handling
Always handle download errors gracefully:
```typescript
try {
  await downloadReport(employeeIds);
} catch (error) {
  if (error.response?.status === 400) {
    alert('Invalid employee IDs');
  } else if (error.response?.status === 500) {
    alert('Server error. Please try again later.');
  } else {
    alert('Failed to download report');
  }
}
```

---

## Performance Considerations

### Generation Time
- **1-5 employees**: ~1-2 seconds
- **5-10 employees**: ~2-4 seconds
- **10-20 employees**: ~4-8 seconds
- **20+ employees**: ~8+ seconds

### Optimization Tips
1. Reports are generated in-memory then saved to disk
2. Buffer is sent directly to client for faster delivery
3. Files are stored on server for backup/audit purposes
4. Implement periodic cleanup of old files (recommended: 30 days)
5. For very large datasets, consider implementing pagination or background job processing

### Disk Space Management
- Each report: ~15-50 KB
- 100 reports/day = ~1.5-5 MB/day
- 30 days = ~45-150 MB
- Implement automatic cleanup to manage disk space

---

## Testing

### Test with Single Employee
```bash
curl -X GET "http://localhost:3000/registration-report/export/excel?employeeIds=emp123" \
  -H "Authorization: Bearer TOKEN" \
  --output test_report.xlsx
```

### Test with Multiple Employees
```bash
curl -X GET "http://localhost:3000/registration-report/export/excel?employeeIds=emp1&employeeIds=emp2" \
  -H "Authorization: Bearer TOKEN" \
  --output test_report.xlsx
```

### Verify File
```bash
# Check if file was created
ls -lh test_report.xlsx

# Open file (macOS)
open test_report.xlsx

# Open file (Windows)
start test_report.xlsx

# Open file (Linux)
xdg-open test_report.xlsx
```

---

## Troubleshooting

### Issue: File Not Downloading
**Solution:** Ensure `responseType: 'blob'` is set in Axios request

### Issue: Corrupted File
**Solution:** Check that the response is not being parsed as JSON

### Issue: Empty File
**Solution:** Verify employee IDs exist and have registration data

### Issue: Slow Generation
**Solution:** Reduce number of employees or implement caching

---

## Notes

1. **Authentication Required**: All requests must include valid JWT token
2. **File Format**: Excel 2007+ (.xlsx format)
3. **Data Period**: Report shows data for last month
4. **Time Zone**: All dates are in server time zone
5. **Dual Storage**: Files are saved to server AND sent to client
6. **File Location**: `reports/registration/Registration_Report_YYYY-MM-DD.xlsx`
7. **Concurrent Requests**: Limit concurrent report generation requests to avoid memory issues
8. **File Cleanup**: Implement periodic cleanup to manage disk space

---

## Related APIs

- [GET /registration-report/counts/vendor](./REGISTRATION_REPORT_API.md#1-get-vendor-registration-report)
- [GET /registration-report/counts/farmer](./REGISTRATION_REPORT_API.md#2-get-farmer-registration-report)
- [GET /registration-report/count/customer](./REGISTRATION_REPORT_API.md#3-get-customer-registration-report)

---

## Support

For issues or questions:
1. Verify employee IDs are valid
2. Check authentication token
3. Ensure client is configured to receive binary data (`responseType: 'blob'`)
4. Review server logs for detailed error messages
5. Test with a single employee ID first
6. Check network timeout settings if dealing with large datasets
7. Verify `reports/registration/` directory has write permissions
8. Check available disk space on server
