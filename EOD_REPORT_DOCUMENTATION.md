# End of Day (EOD) Report Documentation

## Overview
The End of Day Report provides a comprehensive summary of all daily operations including purchases, sales, inward movements, dumps, and stock positions.

## API Endpoint

### GET `/inventoryStock/endoftheday/eod-report`

**Query Parameters:**
- `companyId` (optional): Filter by company ID
- `locationId` (optional): Filter by location/branch ID
- `startDate` (optional): Start date for the report (format: YYYY-MM-DD)
  - Time: Automatically set to 00:00:00 (start of day)
- `endDate` (optional): End date for the report (format: YYYY-MM-DD)
  - Time: Automatically set to 23:59:59 (end of day)

**Example Requests:**

1. **Get EOD report for a specific date range:**
```
GET /inventoryStock/endoftheday/eod-report?companyId=123&locationId=456&startDate=2024-01-01&endDate=2024-01-31
```

2. **Get EOD report for all time:**
```
GET /inventoryStock/endoftheday/eod-report?companyId=123&locationId=456
```

3. **Get EOD report for all companies and locations:**
```
GET /inventoryStock/endoftheday/eod-report
```

## Response Structure

```json
{
  "status": "success",
  "data": {
    "reportDate": "2024-01-01 to 2024-01-31",
    "companyId": "123",
    "locationId": "456",
    
    "openingStock": {
      "qty": 1000.50,
      "amount": 50000.00
    },
    
    "purchase": {
      "totalGrnCount": 25,
      "totalPurchaseQty": 500.00,
      "totalPurchaseAmt": 25000.00,
      "rtvQty": 50.00,
      "rtvAmt": 2500.00,
      "nonRtvQty": 450.00,
      "nonRtvAmt": 22500.00,
      "totalFreight": 1000.00,
      "totalOtherCharges": 500.00,
      "totalLandingCost": 26500.00
    },
    
    "inward": {
      "totalInwardCount": 15,
      "totalInwardQty": 200.00,
      "totalInwardAmt": 10000.00
    },
    
    "dump": {
      "totalDumpCount": 5,
      "totalDumpQty": 30.00,
      "totalDumpAmt": 1500.00
    },
    
    "sales": {
      "totalSalesCount": 40,
      "totalSalesQty": 600.00,
      "totalSalesAmt": 60000.00
    },
    
    "closingStock": {
      "qty": 1070.50,
      "amount": 84000.00
    },
    
    "summary": {
      "totalDocumentsCreated": 85,
      "netStockMovement": {
        "qty": 70.50,
        "amount": 34000.00
      }
    }
  }
}
```

## Report Sections Explained

### 1. Opening Stock
- **qty**: Total quantity in stock at the beginning of the period
- **amount**: Total value of opening stock (Qty × Landing Purchase Price)

### 2. Purchase (GRN - Goods Receipt Note)
- **totalGrnCount**: Number of GRN documents created
- **totalPurchaseQty**: Total quantity purchased
- **totalPurchaseAmt**: Total purchase amount
- **rtvQty**: Return to Vendor quantity
- **rtvAmt**: Return to Vendor amount
- **nonRtvQty**: Non-RTV purchase quantity
- **nonRtvAmt**: Non-RTV purchase amount
- **totalFreight**: Total freight/hamali charges
- **totalOtherCharges**: Local transport, mandi cess, market entry fees
- **totalLandingCost**: Total purchase amount + freight + other charges

### 3. Inward
- **totalInwardCount**: Number of inward register documents created
- **totalInwardQty**: Total quantity received through inward (production, transfers, etc.)
- **totalInwardAmt**: Total inward amount at landing rate

### 4. Dump
- **totalDumpCount**: Number of dump documents created
- **totalDumpQty**: Total quantity dumped/wasted
- **totalDumpAmt**: Total dump cost (calculated at stock cost)

### 5. Sales (Customer Delivery Challan)
- **totalSalesCount**: Number of customer delivery challans created
- **totalSalesQty**: Total quantity sold
- **totalSalesAmt**: Total sales amount (invoice amount)

### 6. Closing Stock
- **qty**: Calculated as: Opening Stock + Purchase + Inward - Dump - Sales
- **amount**: Calculated value of closing stock

### 7. Summary
- **totalDocumentsCreated**: Total number of all documents (GRN + Dump + Sales + Inward)
- **netStockMovement**: Net change in stock during the period

## Calculation Logic

### Closing Stock Calculation:
```
Closing Stock Qty = Opening Stock Qty + Purchase Qty + Inward Qty - Dump Qty - Sales Qty
Closing Stock Amount = Opening Stock Amount + Purchase Amount + Inward Amount - Dump Amount - Sales Amount
```

### Total Landing Cost:
```
Total Landing Cost = Purchase Amount + Freight + Other Charges
```

### Net Stock Movement:
```
Net Movement Qty = Purchase Qty + Inward Qty - Dump Qty - Sales Qty
Net Movement Amount = Purchase Amount + Inward Amount - Dump Amount - Sales Amount
```

## Use Cases

1. **Daily Operations Review**: Get a snapshot of all activities for a specific day
2. **Monthly Reports**: Generate monthly summaries by specifying start and end dates
3. **Location Performance**: Compare performance across different locations
4. **Stock Reconciliation**: Verify opening and closing stock positions
5. **Financial Analysis**: Track purchase costs, sales revenue, and stock value changes

## Notes

- All amounts are in the base currency of the system
- All quantities are in the base unit of measurement (typically KG)
- RTV (Return to Vendor) items are tracked separately in purchase metrics
- The report includes both approved and pending documents (adjust based on your business logic)
- Date filters use the document creation date/timestamp


## Extended EOD Report Metrics (Updated)

The EOD report now includes comprehensive business metrics:

### Additional Metrics

#### 6. Invoices
- **totalInvoiceCount**: Number of invoices generated
- **totalNumberOfInvoicesGenerated**: Same as above (for clarity)

#### 7. Stock Transfer (Internal Transfer to DC)
- **totalTransferCount**: Number of stock transfer documents
- **totalTransferQty**: Total quantity transferred
- **totalTransferAmt**: Total amount of transfers
- **internalTransferToDC**: Total value of internal transfers

#### 8. Customer Returns (Salvaged)
- **totalReturnCount**: Number of return documents
- **totalReturnQty**: Total quantity returned
- **totalReturnAmt**: Total amount of returns
- **customerReturnsSalvaged**: Value of salvaged returns

#### 9. Second Sale (Salvaged)
- **totalSecondSaleCount**: Number of second sale documents
- **totalSecondSaleQty**: Total quantity sold as second sale
- **totalSecondSaleAmt**: Total amount from second sales
- **secondSaleForTheDay**: Total second sale value for the day

#### 10. Shrinkage / Weight Loss
- **qty**: Quantity lost due to shrinkage
- **amount**: Value of shrinkage at landing cost
- **totalShrinkageWeightLossAtLandingCost**: Total shrinkage value

#### 11. Pilferages
- **qty**: Quantity lost to pilferage (placeholder - requires business logic)
- **amount**: Value of pilferage
- **pilferagesAtLandingCost**: Total pilferage value

#### 12. Difference
- **qty**: Difference in quantity (calculated)
- **amount**: Difference in value
- **differenceAtLandingCost**: Total difference at landing cost

#### 13. Financials
- **collectionsForTheDay**: Total cash collected for the day
- **outstandingAsOnDate**: Total outstanding amount
- **npaIfAny**: Non-Performing Assets (requires aging analysis)

### Updated Closing Stock Calculation

```
Closing Stock = Opening Stock + Purchase + Inward - Dump - Sales - Stock Transfer + Customer Returns
```

### Shrinkage Calculation

```
Expected Stock = Opening Stock + Purchase + Inward
Actual Movement = Dump + Sales + Stock Transfer - Returns
Shrinkage = Expected Stock - Actual Movement - Closing Stock
Shrinkage Value = Shrinkage Qty × Average Landing Cost
```

### Average Landing Cost

```
Average Landing Cost = (Total Purchase Amount + Freight + Other Charges) / Total Purchase Qty
```

## Complete Response Example

```json
{
  "status": "success",
  "data": {
    "reportDate": "2024-01-01 to 2024-01-31",
    "companyId": "123",
    "locationId": "456",
    
    "openingStock": {
      "qty": 1000.50,
      "amount": 50000.00
    },
    
    "purchase": {
      "totalGrnCount": 25,
      "totalPurchaseQty": 500.00,
      "totalPurchaseAmt": 25000.00,
      "rtvQty": 50.00,
      "rtvAmt": 2500.00,
      "nonRtvQty": 450.00,
      "nonRtvAmt": 22500.00,
      "totalFreight": 1000.00,
      "totalOtherCharges": 500.00,
      "totalLandingCost": 26500.00
    },
    
    "inward": {
      "totalInwardCount": 15,
      "totalInwardQty": 200.00,
      "totalInwardAmt": 10000.00
    },
    
    "dump": {
      "totalDumpCount": 5,
      "totalDumpQty": 30.00,
      "totalDumpAmt": 1500.00,
      "totalDumpAtLandingCost": 1500.00
    },
    
    "sales": {
      "totalSalesCount": 40,
      "totalSalesQty": 600.00,
      "totalSalesAmt": 60000.00,
      "totalB2CSalesForTheDay": 60000.00
    },
    
    "invoices": {
      "totalInvoiceCount": 40,
      "totalNumberOfInvoicesGenerated": 40
    },
    
    "stockTransfer": {
      "totalTransferCount": 10,
      "totalTransferQty": 100.00,
      "totalTransferAmt": 5000.00,
      "internalTransferToDC": 5000.00
    },
    
    "customerReturns": {
      "totalReturnCount": 3,
      "totalReturnQty": 20.00,
      "totalReturnAmt": 2000.00,
      "customerReturnsSalvaged": 2000.00
    },
    
    "secondSale": {
      "totalSecondSaleCount": 2,
      "totalSecondSaleQty": 15.00,
      "totalSecondSaleAmt": 750.00,
      "secondSaleForTheDay": 750.00
    },
    
    "shrinkage": {
      "qty": 5.50,
      "amount": 291.50,
      "totalShrinkageWeightLossAtLandingCost": 291.50
    },
    
    "pilferages": {
      "qty": 0,
      "amount": 0,
      "pilferagesAtLandingCost": 0
    },
    
    "difference": {
      "qty": 5.50,
      "amount": 291.50,
      "differenceAtLandingCost": 291.50
    },
    
    "closingStock": {
      "qty": 1070.50,
      "amount": 84000.00,
      "closingStockAtLandingCost": 84000.00
    },
    
    "financials": {
      "collectionsForTheDay": 45000.00,
      "outstandingAsOnDate": 15000.00,
      "npaIfAny": 0
    },
    
    "summary": {
      "totalDocumentsCreated": 140,
      "netStockMovement": {
        "qty": 70.00,
        "amount": 34000.00
      }
    }
  }
}
```

## Business Metrics Explained

1. **Total Number of Invoices Generated**: Count of all invoices created for the period
2. **Internal Transfer to DC**: Stock transferred between distribution centers
3. **Total B2C Sales for the Day**: Business-to-consumer sales from customer delivery challans
4. **Customer Returns Salvaged**: Returns that can be resold or salvaged
5. **Second Sale for the Day**: Sales of damaged/rejected goods at reduced prices
6. **Total Dump for the Day (Landing Cost)**: Wastage valued at purchase cost
7. **Total Shrinkage/Weight Loss (Landing Cost)**: Natural weight loss during storage/handling
8. **Pilferages (Qty × Landing Cost)**: Theft or unauthorized removal of stock
9. **Difference (Qty × Landing Cost)**: Unexplained variance in stock
10. **Closing Stock (Qty × Landing Cost)**: End-of-day inventory value
11. **Collections for the Day**: Cash/payments received
12. **Outstanding as on Date**: Pending payments from customers
13. **NPA if Any**: Non-performing assets (overdue payments)


## Date Range Behavior

### Single Day Report
When you provide the same date for both start and end:
```
GET /inventoryStock/endoftheday/eod-report?startDate=2025-11-18&endDate=2025-11-18
```

**Time Range Covered:**
- Start: `2025-11-18 00:00:00` (midnight, beginning of day)
- End: `2025-11-18 23:59:59` (one second before midnight, end of day)

This captures **all transactions for the entire day** from midnight to midnight.

### Multiple Day Report
When you provide different dates:
```
GET /inventoryStock/endoftheday/eod-report?startDate=2025-11-01&endDate=2025-11-30
```

**Time Range Covered:**
- Start: `2025-11-01 00:00:00` (beginning of first day)
- End: `2025-11-30 23:59:59` (end of last day)

This captures **all transactions for the entire month**.

### Important Notes

1. **Date Format**: Always use `YYYY-MM-DD` format
2. **Timezone**: All times are in the server's timezone (typically IST - Indian Standard Time)
3. **Inclusive Range**: Both start and end dates are included in the report
4. **Automatic Time Addition**: You don't need to specify time - it's automatically added
   - Start date gets `00:00:00`
   - End date gets `23:59:59`

### Examples

**Today's Report:**
```
GET /inventoryStock/endoftheday/eod-report?startDate=2025-11-18&endDate=2025-11-18
```
Covers: 2025-11-18 00:00:00 to 2025-11-18 23:59:59

**This Week's Report:**
```
GET /inventoryStock/endoftheday/eod-report?startDate=2025-11-12&endDate=2025-11-18
```
Covers: 2025-11-12 00:00:00 to 2025-11-18 23:59:59

**This Month's Report:**
```
GET /inventoryStock/endoftheday/eod-report?startDate=2025-11-01&endDate=2025-11-30
```
Covers: 2025-11-01 00:00:00 to 2025-11-30 23:59:59
