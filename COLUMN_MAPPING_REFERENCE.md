# Column Mapping Reference for EOD Report

## Entity Column Names

This document provides a quick reference for the column names used in different product entities to avoid confusion when writing queries.

### GrnProduct (grn_products table)
- **Quantity Column**: `netWeight` (decimal 100,3)
- **Amount Column**: `amount` (decimal 12,2)
- **Other Columns**: 
  - `quantity` (decimal 10,2)
  - `grossWeight` (decimal 100,3)
  - `packingMaterialWeight` (decimal 100,3)
  - `rtv` (boolean) - Return to Vendor flag

### InwardProduct (inwardProduct table)
- **Quantity Column**: `netWeight` (decimal 100,3)
- **Amount Column**: `amount`
- **Other Columns**:
  - `quantity`
  - `grossWeight` (decimal 100,3)
  - `packingMaterialWeight` (decimal 100,3)

### Item / Delivery Challan Product (item table)
- **Quantity Column**: `netWeight` (decimal 20,4)
- **Amount Column**: `amount` (decimal 20,4)
- **Other Columns**:
  - `quantity` (decimal 20,3)
  - `grossWeight` (decimal 20,4)
  - `packingMaterialWeight` (decimal 20,4)

### DumpProduct (dump_product table) ⚠️ DIFFERENT
- **Quantity Column**: `quantity` (decimal 12,2) ⚠️ **NOT netWeight**
- **Amount Column**: `amount` (decimal 12,2)
- **Note**: This entity does NOT have a `netWeight` column

## Query Examples

### Correct Query for GRN
```typescript
.addSelect('COALESCE(SUM("grnProduct"."netWeight"), 0)', 'totalPurchaseQty')
.addSelect('COALESCE(SUM("grnProduct"."amount"), 0)', 'totalPurchaseAmt')
```

### Correct Query for Inward
```typescript
.addSelect('COALESCE(SUM("inwardProduct"."netWeight"), 0)', 'totalInwardQty')
.addSelect('COALESCE(SUM("inwardProduct"."amount"), 0)', 'totalInwardAmt')
```

### Correct Query for Delivery Challan (Sales)
```typescript
.addSelect('COALESCE(SUM("dcProduct"."netWeight"), 0)', 'totalSalesQty')
.addSelect('COALESCE(SUM("dcProduct"."amount"), 0)', 'totalSalesAmt')
```

### Correct Query for Dump ⚠️
```typescript
.addSelect('COALESCE(SUM("dumpProduct"."quantity"), 0)', 'totalDumpQty')  // Use quantity, NOT netWeight
.addSelect('COALESCE(SUM("dumpProduct"."amount"), 0)', 'totalDumpAmt')
```

## Important Notes

1. **Always use double quotes** around table aliases and column names in TypeORM queries to ensure PostgreSQL properly recognizes them
2. **Use COALESCE** to handle NULL values and return 0 instead
3. **DumpProduct is the exception** - it uses `quantity` instead of `netWeight`
4. When in doubt, check the entity file to verify column names


### ReturnedProducts (returned_products_by_customer table) ⚠️ SPECIAL
- **Returned Quantity Column**: `returnedNetWt` (decimal 10,2) - Net weight of returned items
- **Returned Amount Column**: `returnedQtyAmt` (decimal 10,2) - Amount for returned items
- **Rejected Quantity Column**: `rejectedNetWt` (decimal 10,2) - Net weight of rejected items
- **Rejected Amount Column**: `rejectedQtyAmt` (decimal 10,2) - Amount for rejected items
- **Other Columns**:
  - `returnedQty` (decimal 10,2) - Returned quantity in UOM
  - `rejectedQty` (decimal 10,2) - Rejected quantity in UOM
  - `returnedGrossWt` (decimal 10,2)
  - `rejectedGrossWt` (decimal 10,2)
  - `returnedPackingMaterialWt` (decimal 10,2)
  - `rejectedPackingMaterialWt` (decimal 10,2)
- **Note**: This entity tracks BOTH returned and rejected products separately

## Query Examples (Updated)

### Correct Query for Customer Returns ⚠️
```typescript
.addSelect('COALESCE(SUM("returnProduct"."returnedNetWt"), 0)', 'totalReturnQty')
.addSelect('COALESCE(SUM("returnProduct"."returnedQtyAmt"), 0)', 'totalReturnAmt')
.addSelect('COALESCE(SUM("returnProduct"."rejectedNetWt"), 0)', 'totalRejectedQty')
.addSelect('COALESCE(SUM("returnProduct"."rejectedQtyAmt"), 0)', 'totalRejectedAmt')
```

## Summary Table

| Entity | Quantity Column | Amount Column | Notes |
|--------|----------------|---------------|-------|
| GrnProduct | `netWeight` | `amount` | Standard |
| InwardProduct | `netWeight` | `amount` | Standard |
| Item (DC Product) | `netWeight` | `amount` | Standard |
| DumpProduct | `quantity` | `amount` | ⚠️ Uses quantity, not netWeight |
| ReturnedProducts | `returnedNetWt` / `rejectedNetWt` | `returnedQtyAmt` / `rejectedQtyAmt` | ⚠️ Separate columns for returned vs rejected |
