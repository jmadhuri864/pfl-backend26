# EOD Report - Quick Formula Reference

## Core Formulas

### Average Landing Cost
```
Avg Landing Cost = (Purchase Amount + Freight + Other Charges) / Purchase Qty
```

### Closing Stock
```
Closing Stock = Opening + Purchase + Inward + Returns (Returned only) 
              - Dump - Sales - Transfer - Second Sale
```

### Expected Stock
```
Expected Stock = Opening + Purchase + Inward + Returns (Returned only)
```

### Accounted Stock
```
Accounted Stock = Dump + Sales + Transfer + Second Sale + Closing Stock
```

### Total Variance
```
Total Variance = Expected Stock - Accounted Stock
```

### Natural Shrinkage (3% default)
```
Natural Shrinkage = (Purchase + Inward) × 0.03
Actual Shrinkage = MIN(Total Variance, Natural Shrinkage)
```

### Pilferage (Theft)
```
Pilferage = MAX(0, Total Variance - Natural Shrinkage)
```

### Breakdown
```
Total Variance = Actual Shrinkage + Pilferage
```

---

## Quick Example

**Given:**
- Opening: 1,000 kg
- Purchase: 500 kg @ ₹25,000 + ₹1,500 charges
- Inward: 200 kg
- Returns (Returned): 20 kg
- Dump: 30 kg
- Sales: 600 kg
- Transfer: 100 kg
- Second Sale: 15 kg
- Physical Closing: 960 kg

**Calculate:**

1. **Avg Landing Cost** = (25,000 + 1,500) / 500 = **₹53/kg**

2. **Expected Stock** = 1,000 + 500 + 200 + 20 = **1,720 kg**

3. **Calculated Closing** = 1,000 + 500 + 200 + 20 - 30 - 600 - 100 - 15 = **975 kg**

4. **Accounted Stock** = 30 + 600 + 100 + 15 + 960 = **1,705 kg**

5. **Total Variance** = 1,720 - 1,705 = **15 kg** (₹795)

6. **Natural Shrinkage** = (500 + 200) × 0.03 = **21 kg** (₹1,113)

7. **Actual Shrinkage** = MIN(15, 21) = **15 kg** (₹795)

8. **Pilferage** = MAX(0, 15 - 21) = **0 kg** ✓ Good!

**Result:** All variance explained by natural shrinkage. No theft detected.

---

## When to Investigate

| Condition | Action |
|-----------|--------|
| Pilferage > 0 | Investigate immediately |
| Variance > 5% | Physical stock verification |
| Shrinkage > 5% | Review storage conditions |
| Outstanding > ₹100K | Collection follow-up |
