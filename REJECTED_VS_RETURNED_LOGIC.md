# Rejected vs Returned Items - Logic Explained

## The Key Difference

### ✅ Returned Items (Salvageable)
- **Quality**: Good condition, can be resold
- **Reason**: Customer ordered too much, changed mind, etc.
- **Stock Impact**: **ADD to Closing Stock** ✓
- **Next Action**: Put back on shelf, resell at full price

### ❌ Rejected Items (Damaged/Non-salvageable)
- **Quality**: Damaged, expired, not meeting specifications
- **Reason**: Quality issues, damage during transport, etc.
- **Stock Impact**: **NOT added to Closing Stock** ✗
- **Next Action**: Either:
  - Dispose (counted in **Dump**)
  - Sell at reduced price (counted in **Second Sale**)

---

## Why This Logic?

### Closing Stock = Sellable Inventory

**Closing Stock should only include items that can be sold at regular price.**

#### Returned Items ✓
```
Customer: "I ordered 100 kg but only need 80 kg"
Status: 20 kg returned, perfect condition
Action: Add to closing stock
Reason: Can be resold at full price
```

#### Rejected Items ✗
```
Customer: "These 10 kg apples are rotten"
Status: 10 kg rejected, damaged
Action: NOT added to closing stock
Reason: Cannot be sold at regular price
Next Step: 
  - If completely bad → Dump (dispose)
  - If partially salvageable → Second Sale (reduced price)
```

---

## The Correct Formula

```
Closing Stock = Opening 
              + Purchase 
              + Inward 
              + Returns (Returned ONLY)    ← Only salvageable items
              - Dump 
              - Sales 
              - Stock Transfer 
              - Second Sale
```

---

## What Happens to Rejected Items?

### Path 1: Complete Disposal (Dump)
```
Rejected: 10 kg rotten apples
Decision: Cannot be sold at all
Action: Dispose/throw away
Recorded in: Dump (10 kg)
Impact: Subtracted from stock via Dump
```

### Path 2: Partial Salvage (Second Sale)
```
Rejected: 10 kg slightly damaged apples
Decision: Can be sold at 50% discount
Action: Sell as "Second Sale"
Recorded in: Second Sale (10 kg)
Impact: Subtracted from stock via Second Sale
```

### Path 3: Return to Vendor (RTV)
```
Rejected: 10 kg wrong variety
Decision: Return to supplier
Action: Send back to vendor
Recorded in: RTV in GRN
Impact: Not counted in purchase
```

---

## Example Scenario

### Day's Transactions:
1. **Customer Order**: 100 kg apples delivered
2. **Customer Returns**: 20 kg (ordered too much) - Good quality
3. **Customer Rejects**: 10 kg (damaged during transport)
4. **Your Decision on Rejected**:
   - 5 kg completely rotten → Dump
   - 5 kg slightly damaged → Second Sale at 50% off

### Recording:
```
Returns (Returned): 20 kg  → ADD to Closing Stock ✓
Dump: 5 kg                 → SUBTRACT from stock
Second Sale: 5 kg          → SUBTRACT from stock
Rejected: 10 kg            → NOT added to Closing Stock
```

### Closing Stock Calculation:
```
Opening: 1,000 kg
+ Returns (Returned): 20 kg    ← Only this is added
- Dump: 5 kg                   ← Rejected items disposed
- Second Sale: 5 kg            ← Rejected items sold cheap
= Closing: 1,010 kg
```

---

## Summary Table

| Item Type | Quality | Add to Closing Stock? | Where Recorded? |
|-----------|---------|----------------------|-----------------|
| **Returned** | Good | ✅ YES | Closing Stock |
| **Rejected** | Damaged | ❌ NO | Dump or Second Sale |

---

## Business Logic

### Why Not Add Rejected Items?

1. **Inventory Accuracy**: Closing stock should reflect sellable inventory
2. **Valuation**: Rejected items have reduced/zero value
3. **Accounting**: Prevents overstatement of assets
4. **Operations**: Clear separation between good and damaged stock

### Benefits of This Approach:

✅ **Accurate Stock Value**: Only good quality stock counted  
✅ **Clear Tracking**: Damaged goods tracked separately  
✅ **Better Decisions**: Know exactly what's sellable  
✅ **Proper Accounting**: Assets valued correctly  

---

## Quick Decision Tree

```
Customer Returns Item
        │
        ▼
   Is it sellable at
   regular price?
        │
    ┌───┴───┐
    │       │
   YES      NO
    │       │
    ▼       ▼
RETURNED  REJECTED
    │       │
    ▼       ▼
  ADD to   NOT added
  Closing  to Closing
  Stock    Stock
            │
        ┌───┴───┐
        │       │
        ▼       ▼
      DUMP   SECOND
             SALE
```

---

## Final Formula (Confirmed)

```
Closing Stock = Opening 
              + Purchase 
              + Inward 
              + Customer Returns (Returned ONLY)
              - Dump 
              - Sales 
              - Stock Transfer 
              - Second Sale
```

**Rejected items are handled through Dump or Second Sale, NOT added to Closing Stock.**
