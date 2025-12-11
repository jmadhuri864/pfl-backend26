# End of Day Report - Calculations Guide

## Overview
This document explains all calculations used in the End of Day (EOD) Report, including formulas, logic, and examples.

---

## 1. Average Landing Cost

**Purpose**: Calculate the actual cost per unit including all charges

**Formula**:
```
Average Landing Cost = (Total Purchase Amount + Freight + Other Charges) / Total Purchase Qty
```

**Example**:
- Total Purchase Amount: ₹25,000
- Freight: ₹1,000
- Other Charges: ₹500
- Total Purchase Qty: 500 kg

```
Average Landing Cost = (25,000 + 1,000 + 500) / 500
                     = 26,500 / 500
                     = ₹53 per kg
```

---

## 2. Opening Stock

**Purpose**: Stock available at the beginning of the period

**Source**: Retrieved from `inventory_stock` table

**Components**:
- `openingStockQty`: Total quantity in stock
- `openingStockAmt`: Total value of stock

**Note**: This is the closing stock from the previous period

---

## 3. Closing Stock

**Purpose**: Stock available at the end of the period

**Formula**:
```
Closing Stock Qty = Opening Stock 
                  + Purchase 
                  + Inward 
                  + Customer Returns (Returned)    ← Only salvageable returned items
                  - Dump                           ← Intentional disposal
                  - Sales                          ← Regular B2C sales
                  - Stock Transfer                 ← Sent to other locations
                  - Second Sale                    ← Salvaged goods sold at reduced price
```

**Note**: Rejected items are NOT added to closing stock as they are typically disposed or sold as second sale.

**Formula (Amount)**:
```
Closing Stock Amount = Closing Stock Qty × Average Landing Cost
```

**Example**:
- Opening Stock: 1,000 kg
- Purchase: 500 kg
- Inward: 200 kg
- Returns (Returned): 20 kg
- Dump: 30 kg
- Sales: 600 kg
- Stock Transfer: 100 kg
- Second Sale: 15 kg

```
Closing Stock = 1,000 + 500 + 200 + 20 - 30 - 600 - 100 - 15
              = 975 kg

Closing Stock Amount = 975 × ₹53 = ₹51,675
```

---

## 4. Expected Stock

**Purpose**: Calculate what stock should be available based on movements

**Formula**:
```
Expected Stock = Opening Stock 
               + Purchase 
               + Inward 
               + Customer Returns (Returned only)
```

**Example**:
```
Expected Stock = 1,000 + 500 + 200 + 20
               = 1,720 kg
```

---

## 5. Accounted Stock

**Purpose**: Calculate all stock that has been accounted for

**Formula**:
```
Accounted Stock = Dump 
                + Sales 
                + Stock Transfer 
                + Second Sale
                + Closing Stock
```

**Example**:
```
Accounted Stock = 30 + 600 + 100 + 15 + 975
                = 1,720 kg
```

---

## 6. Total Variance (Difference)

**Purpose**: Identify any discrepancy between expected and accounted stock

**Formula**:
```
Total Variance Qty = Expected Stock - Accounted Stock
Total Variance Amount = Total Variance Qty × Average Landing Cost
```

**Example**:
```
Total Variance = 1,730 - 1,730 = 0 kg (Perfect match!)

If there was a variance:
Total Variance = 1,730 - 1,680 = 50 kg
Total Variance Amount = 50 × ₹53 = ₹2,650
```

**Interpretation**:
- **Positive Variance**: Stock is missing (loss)
- **Negative Variance**: Extra stock found (gain - rare)
- **Zero Variance**: Perfect accounting

---

## 7. Natural Shrinkage / Weight Loss

**Purpose**: Account for expected weight loss due to natural causes

**Natural Causes Include**:
- Evaporation (especially for fresh produce)
- Drying/dehydration
- Handling loss
- Trimming/cleaning
- Temperature changes

**Formula**:
```
Expected Shrinkage Rate = 3% (configurable, typically 2-5%)
Natural Shrinkage Qty = (Purchase Qty + Inward Qty) × Shrinkage Rate
Natural Shrinkage Amount = Natural Shrinkage Qty × Average Landing Cost

Actual Shrinkage Qty = MIN(Total Variance, Natural Shrinkage Qty)
Actual Shrinkage Amount = Actual Shrinkage Qty × Average Landing Cost
```

**Example**:
- Purchase: 500 kg
- Inward: 200 kg
- Shrinkage Rate: 3%
- Total Variance: 50 kg

```
Natural Shrinkage = (500 + 200) × 0.03
                  = 700 × 0.03
                  = 21 kg

Natural Shrinkage Amount = 21 × ₹53 = ₹1,113

Since Total Variance (50 kg) > Natural Shrinkage (21 kg):
Actual Shrinkage = 21 kg (the natural part)
```

**Typical Shrinkage Rates by Product Type**:
- Fresh Vegetables: 3-5%
- Fresh Fruits: 2-4%
- Leafy Greens: 5-8%
- Root Vegetables: 1-3%
- Packaged Goods: 0.5-1%

---

## 8. Pilferage (Missing Qty - Theft)

**Purpose**: Identify unexplained loss beyond natural shrinkage (potential theft)

**Formula**:
```
Pilferage Qty = MAX(0, Total Variance - Natural Shrinkage)
Pilferage Amount = Pilferage Qty × Average Landing Cost
```

**Example** (continuing from above):
```
Total Variance = 50 kg
Natural Shrinkage = 21 kg

Pilferage = MAX(0, 50 - 21)
          = 29 kg

Pilferage Amount = 29 × ₹53 = ₹1,537
```

**Interpretation**:
- **Zero Pilferage**: All variance explained by natural shrinkage
- **Positive Pilferage**: Unexplained loss - investigate for:
  - Theft
  - Unrecorded sales
  - Counting errors
  - System errors

---

## 9. Breakdown of Total Variance

**Formula**:
```
Total Variance = Natural Shrinkage + Pilferage
```

**Example**:
```
Total Variance = 50 kg (₹2,650)
├── Natural Shrinkage = 21 kg (₹1,113) - 42%
└── Pilferage = 29 kg (₹1,537) - 58%
```

---

## 10. Purchase Metrics

### Total Purchase (GRN)
```
Total Purchase Qty = SUM(All GRN Products netWeight)
Total Purchase Amount = SUM(All GRN Products amount)
```

### RTV (Return to Vendor)
```
RTV Qty = SUM(GRN Products where rtv = true, netWeight)
RTV Amount = SUM(GRN Products where rtv = true, amount)
```

### Non-RTV Purchase
```
Non-RTV Qty = SUM(GRN Products where rtv = false, netWeight)
Non-RTV Amount = SUM(GRN Products where rtv = false, amount)
```

### Total Landing Cost
```
Total Landing Cost = Total Purchase Amount + Freight + Other Charges
```

---

## 11. Sales Metrics

### B2C Sales (Customer Delivery Challan)
```
Total Sales Qty = SUM(Delivery Challan Products netWeight)
Total Sales Amount = SUM(Delivery Challan Products amount)
```

### Invoice Count
```
Total Invoices = COUNT(DISTINCT Invoice IDs)
```

---

## 12. Internal Movements

### Stock Transfer
```
Transfer Qty = SUM(Stock Transfer DC Products netWeight)
Transfer Amount = SUM(Stock Transfer DC Products amount)
```

### Inward Register
```
Inward Qty = SUM(Inward Products netWeight)
Inward Amount = SUM(Inward Products amount)
```

---

## 13. Dump/Wastage

**Purpose**: Track intentional disposal of damaged/expired goods

```
Dump Qty = SUM(Dump Products quantity)  // Note: uses 'quantity', not 'netWeight'
Dump Amount = SUM(Dump Products amount)
```

---

## 14. Customer Returns

### Returned Items (Salvageable)
```
Returned Qty = SUM(Return Products returnedNetWt)
Returned Amount = SUM(Return Products returnedQtyAmt)
```

### Rejected Items (Non-salvageable)
```
Rejected Qty = SUM(Return Products rejectedNetWt)
Rejected Amount = SUM(Return Products rejectedQtyAmt)
```

### Total Returns
```
Total Return Qty = Returned Qty + Rejected Qty
Total Return Amount = Returned Amount + Rejected Amount
```

---

## 15. Second Sale (Salvaged Goods)

**Purpose**: Track sales of damaged/rejected goods at reduced prices

```
Second Sale Qty = SUM(Second Sale totalNetWeight)
Second Sale Amount = SUM(Second Sale totalAmt)
Collections = SUM(Second Sale paidAmount)
Outstanding = SUM(Second Sale pendingAmt)
```

---

## 16. Financial Metrics

### Collections for the Day
```
Collections = SUM(Second Sale paidAmount)
```

### Outstanding as on Date
```
Outstanding = SUM(Second Sale pendingAmt)
```

### NPA (Non-Performing Assets)
```
NPA = Outstanding amounts overdue > 90 days (requires aging analysis)
```

---

## Complete Example Calculation

### Input Data:
- Opening Stock: 1,000 kg @ ₹50,000
- Purchase: 500 kg @ ₹25,000
- Freight: ₹1,000
- Other Charges: ₹500
- Inward: 200 kg @ ₹10,000
- Dump: 30 kg
- Sales: 600 kg
- Stock Transfer: 100 kg
- Returns: 20 kg
- Rejected: 10 kg
- Physical Closing Stock: 980 kg

### Step-by-Step Calculation:

**1. Average Landing Cost**
```
= (25,000 + 1,000 + 500) / 500
= ₹53 per kg
```

**2. Expected Stock**
```
= 1,000 + 500 + 200 + 20 + 10
= 1,730 kg
```

**3. Accounted Stock**
```
= 30 + 600 + 100 + 980
= 1,710 kg
```

**4. Total Variance**
```
= 1,730 - 1,710
= 20 kg
= 20 × ₹53 = ₹1,060
```

**5. Natural Shrinkage (3% rate)**
```
= (500 + 200) × 0.03
= 21 kg
= 21 × ₹53 = ₹1,113
```

**6. Actual Shrinkage**
```
= MIN(20, 21)
= 20 kg (all variance is within natural shrinkage)
```

**7. Pilferage**
```
= MAX(0, 20 - 21)
= 0 kg (no theft detected)
```

**8. Closing Stock Value**
```
= 980 × ₹53
= ₹51,940
```

---

## Key Performance Indicators (KPIs)

### 1. Shrinkage Percentage
```
Shrinkage % = (Actual Shrinkage / Total Purchases) × 100
```
**Target**: < 3% for most products

### 2. Pilferage Percentage
```
Pilferage % = (Pilferage / Total Purchases) × 100
```
**Target**: 0% (any pilferage requires investigation)

### 3. Sales Efficiency
```
Sales Efficiency = (Sales Qty / Available Stock) × 100
Available Stock = Opening + Purchase + Inward
```

### 4. Stock Turnover
```
Stock Turnover = Sales / Average Stock
Average Stock = (Opening Stock + Closing Stock) / 2
```

---

## Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Shrinkage % | > 3% | > 5% |
| Pilferage % | > 0.5% | > 1% |
| Total Variance | > 2% | > 5% |
| Outstanding | > ₹50,000 | > ₹100,000 |

---

## Notes

1. **All amounts are at Landing Cost** unless specified otherwise
2. **Shrinkage Rate is configurable** - adjust based on product type
3. **Pilferage requires investigation** - any non-zero value should be reviewed
4. **Physical stock verification** is recommended when variance > 2%
5. **Date ranges are inclusive** - both start and end dates included in calculations
