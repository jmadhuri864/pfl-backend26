# EOD Report - Formulas Quick Reference Card

## 🎯 Core Formulas (Print This!)

### 1. Average Landing Cost
```
Avg Landing Cost = (Purchase Amt + Freight + Other Charges) / Purchase Qty
```

### 2. Closing Stock
```
Closing = Opening + Purchase + Inward + Returns
        - Dump - Sales - Transfer - Second Sale
```

### 3. Expected Stock
```
Expected = Opening + Purchase + Inward + Returns
```

### 4. Accounted Stock
```
Accounted = Dump + Sales + Transfer + Second Sale + Closing
```

### 5. Total Variance
```
Variance = Expected - Accounted
```

### 6. Natural Shrinkage
```
Natural Shrinkage = (Purchase + Inward) × 3%
```

### 7. Actual Shrinkage
```
Actual Shrinkage = MIN(Variance, Natural Shrinkage)
```

### 8. Pilferage (Theft)
```
Pilferage = MAX(0, Variance - Natural Shrinkage)
```

### 9. Net Stock Movement
```
Net Movement = Purchase + Inward + Returns
             - Dump - Sales - Transfer - Second Sale

OR

Net Movement = Closing - Opening
```

### 10. Variance Type
```
If Variance > 0  → "shortage"
If Variance < 0  → "surplus"
If Variance = 0  → "balanced"
```

---

## 📊 Quick Example

**Given**: Opening 1,000 kg, Purchase 500 kg, Sales 600 kg

**Calculate**:
1. Closing = 1,000 + 500 - 600 = **900 kg**
2. Expected = 1,000 + 500 = **1,500 kg**
3. Accounted = 600 + 900 = **1,500 kg**
4. Variance = 1,500 - 1,500 = **0 kg** ✓ Perfect!

---

## 🚨 Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Shrinkage | > 3% | > 5% |
| Pilferage | > 0.5% | > 1% |
| Variance | > 2% | > 5% |

---

## ✅ Verification Checklist

- [ ] Expected = Accounted? (should match if no variance)
- [ ] Net Movement = Closing - Opening?
- [ ] Pilferage = 0? (any value requires investigation)
- [ ] Shrinkage < 5%?
- [ ] Physical count done?

---

## 💡 Remember

1. **Returns**: Only add RETURNED (salvageable), not REJECTED
2. **Second Sale**: SUBTRACT (it's a sale, stock goes out)
3. **Shrinkage**: Only on NEW stock (Purchase + Inward)
4. **Pilferage**: Anything beyond natural shrinkage
5. **Physical Count**: Always trust physical over calculated
