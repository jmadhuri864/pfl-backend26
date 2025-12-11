# End of Day Report - Complete Formulas Guide

## 📚 Table of Contents
1. [Basic Concepts](#basic-concepts)
2. [All Formulas with Explanations](#all-formulas-with-explanations)
3. [Step-by-Step Example](#step-by-step-example)
4. [Visual Flow Diagram](#visual-flow-diagram)
5. [Common Questions](#common-questions)

---

## Basic Concepts

### What is EOD Report?
End of Day (EOD) Report shows all stock movements and calculates:
- What stock you started with (Opening)
- What came in (Purchase, Inward, Returns)
- What went out (Sales, Dump, Transfer, Second Sale)
- What you should have (Closing)
- Any missing stock (Variance, Shrinkage, Pilferage)

### Key Terms:
- **Landing Cost**: Total cost including purchase price + freight + other charges
- **Shrinkage**: Natural weight loss (evaporation, drying)
- **Pilferage**: Theft or unexplained loss
- **Variance**: Difference between expected and actual stock
- **RTV**: Return to Vendor

---

## All Formulas with Explanations

### 1️⃣ Average Landing Cost

**What it is**: The actual cost per kg/unit including all charges

**Formula**:
```
Average Landing Cost = (Total Purchase Amount + Freight + Other Charges) / Total Purchase Qty
```

**Why we need it**: To value all stock at true cost, not just purchase price

**Example**:
```
Purchase: ₹25,000 for 500 kg
Freight: ₹1,000
Other Charges: ₹500

Average Landing Cost = (25,000 + 1,000 + 500) / 500
                     = 26,500 / 500
                     = ₹53 per kg
```

**Special Case**: If no purchases, returns 0 to avoid division by zero

---

### 2️⃣ Closing Stock (Calculated)

**What it is**: Stock that should be in warehouse at end of day

**Formula**:
```
Closing Stock = Opening Stock
              + Purchase
              + Inward
              + Customer Returns (Returned only - salvageable items)
              - Dump
              - Sales
              - Stock Transfer
              - Second Sale
```

**Why this formula**:
- **ADD** everything that comes INTO warehouse
- **SUBTRACT** everything that goes OUT of warehouse
- **Don't add rejected items** (they will be dumped or sold as second sale)

**Example**:
```
Opening:        1,000 kg
+ Purchase:       500 kg
+ Inward:         200 kg
+ Returns:         20 kg  (only salvageable)
- Dump:           -30 kg
- Sales:         -600 kg
- Transfer:      -100 kg
- Second Sale:    -15 kg
─────────────────────────
Closing:          975 kg
```

**Amount**:
```
Closing Stock Amount = Closing Stock Qty × Average Landing Cost
                     = 975 × ₹53
                     = ₹51,675
```

---

### 3️⃣ Expected Stock

**What it is**: Total stock that should be available (all inflows)

**Formula**:
```
Expected Stock = Opening Stock
               + Purchase
               + Inward
               + Customer Returns (Returned only)
```

**Why we need it**: To compare against what we actually have

**Example**:
```
Expected = 1,000 + 500 + 200 + 20
         = 1,720 kg
```

---

### 4️⃣ Accounted Stock

**What it is**: Total stock we can account for (all outflows + remaining)

**Formula**:
```
Accounted Stock = Dump
                + Sales
                + Stock Transfer
                + Second Sale
                + Closing Stock
```

**Why we need it**: To verify all stock is accounted for

**Example**:
```
Accounted = 30 + 600 + 100 + 15 + 975
          = 1,720 kg
```

**Perfect Scenario**: Expected Stock = Accounted Stock (no variance)

---

### 5️⃣ Total Variance (Difference)

**What it is**: Difference between what we should have and what we can account for

**Formula**:
```
Total Variance Qty = Expected Stock - Accounted Stock
Total Variance Amount = Total Variance Qty × Average Landing Cost
```

**Interpretation**:
- **Positive (+)**: Stock is MISSING (shortage)
- **Negative (-)**: EXTRA stock found (surplus)
- **Zero (0)**: Perfect match (balanced)

**Example 1** (Shortage):
```
Expected: 1,720 kg
Accounted: 1,705 kg
Variance = 1,720 - 1,705 = +15 kg (shortage)
Amount = 15 × ₹53 = ₹795
```

**Example 2** (Balanced):
```
Expected: 1,720 kg
Accounted: 1,720 kg
Variance = 1,720 - 1,720 = 0 kg (perfect!)
```

---

### 6️⃣ Natural Shrinkage (Expected)

**What it is**: Expected weight loss due to natural causes

**Natural Causes**:
- Evaporation (water loss)
- Drying/dehydration
- Handling loss
- Temperature changes
- Trimming/cleaning

**Formula**:
```
Shrinkage Rate = 3% (default, configurable)
Natural Shrinkage Qty = (Purchase Qty + Inward Qty) × Shrinkage Rate
Natural Shrinkage Amount = Natural Shrinkage Qty × Average Landing Cost
```

**Why only Purchase + Inward**: Shrinkage happens to NEW stock, not existing stock

**Example**:
```
Purchase: 500 kg
Inward: 200 kg
Rate: 3%

Natural Shrinkage = (500 + 200) × 0.03
                  = 700 × 0.03
                  = 21 kg

Amount = 21 × ₹53 = ₹1,113
```

**Typical Rates by Product**:
- Fresh Vegetables: 3-5%
- Fresh Fruits: 2-4%
- Leafy Greens: 5-8%
- Root Vegetables: 1-3%
- Packaged Goods: 0.5-1%

---

### 7️⃣ Actual Shrinkage

**What it is**: The actual shrinkage that occurred (cannot exceed variance or expected)

**Formula**:
```
Actual Shrinkage Qty = MIN(Total Variance, Natural Shrinkage)
Actual Shrinkage Amount = Actual Shrinkage Qty × Average Landing Cost
```

**Why MIN**: 
- Can't have more shrinkage than total variance
- Can't have more than naturally expected

**Example 1** (Variance < Natural Shrinkage):
```
Total Variance: 15 kg
Natural Shrinkage: 21 kg
Actual Shrinkage = MIN(15, 21) = 15 kg
(All variance explained by natural shrinkage)
```

**Example 2** (Variance > Natural Shrinkage):
```
Total Variance: 50 kg
Natural Shrinkage: 21 kg
Actual Shrinkage = MIN(50, 21) = 21 kg
(Only 21 kg is natural, rest is pilferage)
```

---

### 8️⃣ Pilferage (Theft)

**What it is**: Unexplained loss beyond natural shrinkage (potential theft)

**Formula**:
```
Pilferage Qty = MAX(0, Total Variance - Natural Shrinkage)
Pilferage Amount = Pilferage Qty × Average Landing Cost
```

**Why MAX(0)**: Can't have negative theft

**Example 1** (No Pilferage):
```
Total Variance: 15 kg
Natural Shrinkage: 21 kg
Pilferage = MAX(0, 15 - 21) = 0 kg
(All loss is natural)
```

**Example 2** (With Pilferage):
```
Total Variance: 50 kg
Natural Shrinkage: 21 kg
Pilferage = MAX(0, 50 - 21) = 29 kg
(29 kg is unexplained - investigate!)
```

**Action Required**: Any pilferage > 0 requires investigation

---

### 9️⃣ Variance Breakdown

**What it is**: How total variance is split between natural and theft

**Formula**:
```
Total Variance = Actual Shrinkage + Pilferage
```

**Example**:
```
Total Variance: 50 kg (₹2,650)
├── Actual Shrinkage: 21 kg (₹1,113) - 42%
└── Pilferage: 29 kg (₹1,537) - 58%
```

---

### 🔟 Net Stock Movement

**What it is**: Net change in stock during the day

**Formula**:
```
Net Stock Movement Qty = Purchase + Inward + Returns (Returned)
                       - Dump - Sales - Transfer - Second Sale

Net Stock Movement Amount = Purchase Amt + Inward Amt + Return Amt
                          - Dump Amt - Sales Amt - Transfer Amt - Second Sale Amt
```

**Verification**:
```
Net Stock Movement = Closing Stock - Opening Stock
```

**Example**:
```
Net Movement = 500 + 200 + 20 - 30 - 600 - 100 - 15
             = -25 kg

Verification: 975 (closing) - 1,000 (opening) = -25 kg ✓
```

**Interpretation**:
- **Positive (+)**: Stock increased
- **Negative (-)**: Stock decreased
- **Zero (0)**: No net change

---

### 1️⃣1️⃣ Total Landing Cost (with RTV Breakdown)

**What it is**: Total cost including all purchases and charges

**Formula**:
```
Total Landing Cost = Total Purchase Amount + Freight + Other Charges

RTV Landing Cost = RTV Amount + (RTV Qty / Total Purchase Qty) × (Freight + Other Charges)

Non-RTV Landing Cost = Non-RTV Amount + (Non-RTV Qty / Total Purchase Qty) × (Freight + Other Charges)
```

**Why proportional allocation**: Freight/charges are shared across all purchases

**Example**:
```
Total Purchase: 500 kg @ ₹25,000
├── RTV: 50 kg @ ₹2,500
└── Non-RTV: 450 kg @ ₹22,500

Freight + Other: ₹1,500

RTV Landing = 2,500 + (50/500) × 1,500
            = 2,500 + 150
            = ₹2,650

Non-RTV Landing = 22,500 + (450/500) × 1,500
                = 22,500 + 1,350
                = ₹23,850

Total = 2,650 + 23,850 = ₹26,500 ✓
```

---

### 1️⃣2️⃣ Variance Type Classification

**What it is**: Categorization of variance for quick understanding

**Formula**:
```
If Total Variance > 0  → "shortage"  (stock missing)
If Total Variance < 0  → "surplus"   (extra stock)
If Total Variance = 0  → "balanced"  (perfect match)
```

**Business Actions**:
- **Shortage**: Investigate shrinkage/pilferage
- **Surplus**: Check for unrecorded inward/returns
- **Balanced**: No action needed

---

### 1️⃣3️⃣ Physical vs Calculated Closing Stock

**What it is**: Support for physical stock count verification

**Formula**:
```
If Physical Count Available:
    Final Closing Qty = Physical Count
    Closing Stock Is Physical = true
Else:
    Final Closing Qty = Calculated Closing Stock
    Closing Stock Is Physical = false
```

**Why we need both**:
- **Calculated**: What system says
- **Physical**: What actual count shows
- **Difference**: Reveals variance

**Example**:
```
Calculated: 975 kg
Physical Count: 960 kg
Variance: 975 - 960 = 15 kg shortage

Report shows:
{
  "qty": 960,                    // Physical count used
  "calculatedQty": 975,          // System calculation
  "closingStockIsPhysical": true // Flag
}
```

---

## Step-by-Step Example

### Given Data:
```
Opening Stock: 1,000 kg
Purchase: 500 kg @ ₹25,000
  ├── RTV: 50 kg @ ₹2,500
  └── Non-RTV: 450 kg @ ₹22,500
Freight: ₹1,000
Other Charges: ₹500
Inward: 200 kg @ ₹10,000
Customer Returns (Returned): 20 kg
Customer Returns (Rejected): 10 kg
Dump: 30 kg
Sales: 600 kg @ ₹60,000
Stock Transfer: 100 kg
Second Sale: 15 kg @ ₹750
Physical Count: 960 kg (actual count)
```

### Step 1: Calculate Average Landing Cost
```
= (25,000 + 1,000 + 500) / 500
= 26,500 / 500
= ₹53 per kg
```

### Step 2: Calculate Closing Stock (Calculated)
```
= 1,000 + 500 + 200 + 20 - 30 - 600 - 100 - 15
= 975 kg
```

### Step 3: Calculate Expected Stock
```
= 1,000 + 500 + 200 + 20
= 1,720 kg
```

### Step 4: Calculate Accounted Stock
```
= 30 + 600 + 100 + 15 + 960 (physical count)
= 1,705 kg
```

### Step 5: Calculate Total Variance
```
= 1,720 - 1,705
= 15 kg (shortage)
= 15 × ₹53 = ₹795
```

### Step 6: Calculate Natural Shrinkage
```
= (500 + 200) × 0.03
= 21 kg
= 21 × ₹53 = ₹1,113
```

### Step 7: Calculate Actual Shrinkage
```
= MIN(15, 21)
= 15 kg
= 15 × ₹53 = ₹795
```

### Step 8: Calculate Pilferage
```
= MAX(0, 15 - 21)
= 0 kg (no theft!)
```

### Step 9: Calculate Net Stock Movement
```
= 500 + 200 + 20 - 30 - 600 - 100 - 15
= -25 kg

Verification: 960 (physical) - 1,000 (opening) = -40 kg
Note: Difference due to variance
```

### Step 10: Calculate Landing Cost Breakdown
```
Total Landing = 25,000 + 1,000 + 500 = ₹26,500

RTV Landing = 2,500 + (50/500) × 1,500 = ₹2,650

Non-RTV Landing = 22,500 + (450/500) × 1,500 = ₹23,850
```

### Final Report Summary:
```
Opening Stock: 1,000 kg @ ₹50,000
Closing Stock: 960 kg @ ₹50,880 (physical count)
Net Movement: -40 kg
Total Variance: 15 kg shortage
├── Natural Shrinkage: 15 kg (all variance explained)
└── Pilferage: 0 kg (no theft)
Variance Type: shortage
```

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 OPENING STOCK: 1,000 kg                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    STOCK COMING IN (+)                      │
├─────────────────────────────────────────────────────────────┤
│  Purchase:                     500 kg                       │
│  Inward:                       200 kg                       │
│  Returns (Returned):            20 kg                       │
├─────────────────────────────────────────────────────────────┤
│  TOTAL IN:                     720 kg                       │
│  EXPECTED STOCK:             1,720 kg                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    STOCK GOING OUT (-)                      │
├─────────────────────────────────────────────────────────────┤
│  Dump:                          30 kg                       │
│  Sales:                        600 kg                       │
│  Stock Transfer:               100 kg                       │
│  Second Sale:                   15 kg                       │
├─────────────────────────────────────────────────────────────┤
│  TOTAL OUT:                    745 kg                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              CALCULATED CLOSING: 975 kg                     │
│              PHYSICAL COUNT: 960 kg                         │
│              VARIANCE: 15 kg (shortage)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  VARIANCE ANALYSIS                          │
├─────────────────────────────────────────────────────────────┤
│  Expected Stock:             1,720 kg                       │
│  Accounted Stock:            1,705 kg                       │
│  Total Variance:                15 kg                       │
│  ├── Natural Shrinkage:        15 kg (100%)                │
│  └── Pilferage:                 0 kg (0%)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Questions

### Q1: Why don't we add rejected items to closing stock?
**A**: Rejected items are damaged and cannot be sold at regular price. They will either be:
- Disposed (counted in Dump)
- Sold at reduced price (counted in Second Sale)

Only salvageable (returned) items go back to regular stock.

---

### Q2: Why is shrinkage only applied to Purchase + Inward?
**A**: Shrinkage happens to NEW stock during handling, storage, and processing. Opening stock has already been through this process.

---

### Q3: What if variance is negative (surplus)?
**A**: Negative variance means you found MORE stock than expected. Possible reasons:
- Unrecorded inward
- Unrecorded returns
- Counting error
- System error

Investigate and correct records.

---

### Q4: Why use physical count instead of calculated?
**A**: Physical count is ACTUAL reality. Calculated is what system thinks. Physical count reveals:
- Counting errors
- Unrecorded transactions
- Shrinkage
- Pilferage

Always trust physical count over calculation.

---

### Q5: How to reduce pilferage?
**A**: 
- Regular physical counts
- CCTV monitoring
- Access control
- Staff training
- Proper documentation
- Surprise audits

---

### Q6: What's a good shrinkage rate?
**A**: Depends on product:
- Fresh produce: 2-5% is normal
- Packaged goods: < 1% is normal
- Leafy greens: 5-8% is acceptable

If actual > expected, investigate storage conditions.

---

### Q7: Why separate RTV and non-RTV landing costs?
**A**: 
- RTV items will be returned to vendor
- Need to track their cost separately
- Helps in vendor negotiations
- Better cost analysis

---

### Q8: What if no physical count is done?
**A**: System uses calculated closing stock. But you should:
- Do physical counts regularly (daily/weekly)
- At least monthly for high-value items
- Quarterly for all items

---

## Quick Reference Table

| Formula | Purpose | Key Point |
|---------|---------|-----------|
| Avg Landing Cost | True cost per unit | Includes all charges |
| Closing Stock | What should remain | Add IN, subtract OUT |
| Expected Stock | Total available | All inflows |
| Accounted Stock | Where it went | All outflows + closing |
| Variance | Missing/extra stock | Expected - Accounted |
| Natural Shrinkage | Expected loss | 3% of new stock |
| Actual Shrinkage | Real natural loss | MIN(variance, natural) |
| Pilferage | Theft | Variance - Natural |
| Net Movement | Daily change | Closing - Opening |
| Variance Type | Quick status | Shortage/Surplus/Balanced |

---

## Summary

**All formulas work together to answer**:
1. What did we start with? (Opening)
2. What came in? (Purchase, Inward, Returns)
3. What went out? (Sales, Dump, Transfer, Second Sale)
4. What should we have? (Calculated Closing)
5. What do we actually have? (Physical Count)
6. What's missing? (Variance)
7. Why is it missing? (Shrinkage vs Pilferage)

**The goal**: Perfect match between expected and actual stock!
