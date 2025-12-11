# Closing Stock Calculation - Logic Explained

## The Correct Formula

```
Closing Stock = Opening Stock 
              + Purchase 
              + Inward 
              + Customer Returns (Returned)    ← ADD (salvageable items come back)
              - Dump 
              - Sales 
              - Stock Transfer 
              - Second Sale                    ← SUBTRACT (sold at reduced price)
```

**Note**: Rejected items are NOT added to closing stock. They are typically:
- Disposed (counted in Dump)
- Sold as salvaged goods (counted in Second Sale)

---

## Why This Logic?

### ➕ ADDITIONS (Stock Coming IN)

| Item | Why ADD? | Example |
|------|----------|---------|
| **Opening Stock** | Starting inventory | 1,000 kg at start of day |
| **Purchase** | New stock bought | 500 kg purchased from vendor |
| **Inward** | Production/transfers IN | 200 kg from production |
| **Returns (Returned)** | Customer returns salvageable items | 20 kg returned, can resell |

### ➖ SUBTRACTIONS (Stock Going OUT)

| Item | Why SUBTRACT? | Example |
|------|---------------|---------|
| **Dump** | Intentionally disposed | 30 kg damaged, thrown away |
| **Sales** | Sold to customers (B2C) | 600 kg sold via delivery challan |
| **Stock Transfer** | Sent to other locations | 100 kg sent to another DC |
| **Second Sale** | Salvaged goods sold | 15 kg damaged goods sold cheap |

---

## Common Confusion: Customer Returns

### ❓ Question: Why only ADD Returned items, not Rejected?

**Answer**: Only salvageable returned items are added back to regular stock!

#### Scenario 1: Returned Items (Salvageable) ✓
```
Customer: "These 20 kg apples are fine, but I ordered too much"
Action: Customer returns them
Result: 20 kg comes BACK to your warehouse (good quality)
Stock Impact: ADD 20 kg ✓
Can be resold at full price
```

#### Scenario 2: Rejected Items (Damaged/Not Meeting Spec) ✗
```
Customer: "These 10 kg apples are damaged, I reject them"
Action: Customer rejects them
Result: 10 kg comes back but NOT added to regular stock
Stock Impact: NOT added to closing stock
Why? Because they will be:
  - Disposed (counted in Dump), OR
  - Sold as salvaged goods (counted in Second Sale)
```

---

## Common Confusion: Second Sale

### ❓ Question: Why SUBTRACT Second Sale?

**Answer**: Second Sale means you SOLD the damaged/salvaged goods!

#### Scenario:
```
You have: 15 kg damaged apples (from returns or quality issues)
Action: Sell them at 50% discount as "Second Sale"
Result: 15 kg LEAVES your warehouse
Stock Impact: SUBTRACT 15 kg ✓
```

**Key Point**: Second Sale is a SALE (goods leave warehouse), not a return!

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    OPENING STOCK: 1,000 kg                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    STOCK COMING IN (+)                      │
├─────────────────────────────────────────────────────────────┤
│  + Purchase:                    500 kg                      │
│  + Inward:                      200 kg                      │
│  + Returns (Returned):           20 kg  ← Salvageable only  │
├─────────────────────────────────────────────────────────────┤
│  TOTAL IN:                      720 kg                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    STOCK GOING OUT (-)                      │
├─────────────────────────────────────────────────────────────┤
│  - Dump:                         30 kg  ← Thrown away       │
│  - Sales:                       600 kg  ← Sold to customers │
│  - Stock Transfer:              100 kg  ← Sent to other DC  │
│  - Second Sale:                  15 kg  ← Salvaged goods    │
├─────────────────────────────────────────────────────────────┤
│  TOTAL OUT:                     745 kg                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOSING STOCK: 975 kg                          │
│         (1,000 + 720 - 745 = 975 kg)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Example

### Given Data:
- Opening Stock: 1,000 kg
- Purchase: 500 kg
- Inward: 200 kg
- Customer Returns (Returned): 20 kg
- Dump: 30 kg
- Sales: 600 kg
- Stock Transfer: 100 kg
- Second Sale: 15 kg

### Calculation:

**Step 1: Add all stock coming IN**
```
Opening:  1,000 kg
Purchase:   500 kg
Inward:     200 kg
Returned:    20 kg (salvageable only)
─────────────────
Total IN: 1,720 kg
```

**Step 2: Subtract all stock going OUT**
```
Dump:        30 kg
Sales:      600 kg
Transfer:   100 kg
Second Sale: 15 kg
─────────────────
Total OUT:  745 kg
```

**Step 3: Calculate Closing Stock**
```
Closing Stock = Total IN - Total OUT
              = 1,720 - 745
              = 975 kg ✓
```

---

## Verification: Expected vs Accounted

### Expected Stock (What should be there):
```
Expected = Opening + Purchase + Inward + Returns (Returned only)
         = 1,000 + 500 + 200 + 20
         = 1,720 kg
```

### Accounted Stock (Where it went):
```
Accounted = Dump + Sales + Transfer + Second Sale + Closing
          = 30 + 600 + 100 + 15 + 975
          = 1,720 kg ✓
```

**Perfect Match!** ✓ No variance, no shrinkage, no pilferage.

---

## Key Takeaways

1. ✅ **Customer Returns (Returned only)** → ADD (salvageable items come back)
2. ✅ **Customer Returns (Rejected)** → NOT added (will be dumped or sold as second sale)
3. ✅ **Second Sale** → SUBTRACT (you sold it, even at reduced price)
4. ✅ **Expected = Accounted** → No variance (ideal scenario)
5. ✅ **If Expected > Accounted** → Stock is missing (shrinkage/pilferage)
6. ✅ **If Expected < Accounted** → Extra stock found (rare, investigate)

---

## Quick Reference

| Transaction | Direction | Impact | Reason |
|-------------|-----------|--------|--------|
| Opening Stock | IN | + | Starting inventory |
| Purchase | IN | + | Bought from vendor |
| Inward | IN | + | Production/transfer in |
| Returns (Returned) | IN | + | Customer returns (salvageable) |
| Dump | OUT | - | Disposed |
| Sales | OUT | - | Sold to customer |
| Transfer | OUT | - | Sent to other location |
| Second Sale | OUT | - | Salvaged goods sold |

**Formula**: Closing = All IN - All OUT
