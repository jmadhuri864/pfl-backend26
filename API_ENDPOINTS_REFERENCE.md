# Complete API Endpoints Reference

## 📊 Sales Target APIs

### 1. Weekly Performance (with filters)
```http
GET /sales-target/performance/:employeeId/:month/:year
Query Params: ?customerId=xxx&productId=yyy
```
**Returns:** Weekly breakdown of targets vs achievements

---

### 2. Sales Per Customer
```http
GET /sales-target/sales-per-customer/:employeeId/:month/:year
```
**Returns:** Aggregated sales data grouped by customer

---

### 3. Sales Per Product
```http
GET /sales-target/sales-per-product/:employeeId/:month/:year
```
**Returns:** Aggregated sales data grouped by product

---

### 4. Sales Summary
```http
GET /sales-target/sales-summary/:employeeId/:month/:year
```
**Returns:** Complete summary with achievement rate, categorization, and insights

---

## 🛒 Procurement Target APIs

### 1. Weekly Performance (with filter)
```http
GET /procurement-target/performance/:employeeId/:month/:year
Query Params: ?productId=xxx
```
**Returns:** Weekly breakdown of procurement targets vs achievements

---

### 2. Procurement Per Product
```http
GET /procurement-target/procurement-per-product/:employeeId/:month/:year
```
**Returns:** Aggregated procurement data grouped by product

---

### 3. Procurement Summary
```http
GET /procurement-target/procurement-summary/:employeeId/:month/:year
```
**Returns:** Complete summary with achievement rate, categorization, and insights

---

## 📋 Response Examples

### Weekly Performance
```json
{
  "success": true,
  "data": [
    {
      "Period": 1,
      "targetAssigned": 5000,
      "targetAchieved": 4500,
      "percentage": 90,
      "variance": -10  // Variance as percentage: -10% (10% below target)
    },
    {
      "Period": 2,
      "targetAssigned": 6000,
      "targetAchieved": 6300,
      "percentage": 105,
      "variance": 5  // Variance as percentage: +5% (5% above target)
    }
  ]
}
```

### Per Customer/Product
```json
{
  "success": true,
  "data": [
    {
      "customerName": "ABC Corp",
      "targetAssigned": 15000,
      "targetAchieved": 14200,
      "percentage": 94.67,
      "variance": -5.33  // Variance as percentage: -5.33% below target
    },
    {
      "productName": "Tomato",
      "targetAssigned": 20000,
      "targetAchieved": 21500,
      "percentage": 107.5,
      "variance": 7.5  // Variance as percentage: +7.5% above target
    }
  ]
}
```

### Summary Statistics
```json
{
  "success": true,
  "data": {
    "achievementRate": 92.1125,
    "totalAssignedQuantity": 40000,
    "totalAchievedQuantity": 36845,
    "productsExceededTarget(>=100%)": 1,
    "productsOnTrack(80-99%)": 3,
    "productsBelowTarget(50-79%)": 0,
    "productsCritical(<50%)": 1,
    "bestPerformingProduct": "Mango",
    "needsAttention": "Banana",
    "bestPerformingWeek": "Week 4",
    "topCustomer": "Shree Agro Buyers"
  }
}
```

---

## 🎯 Quick Copy-Paste Examples

### cURL Examples

```bash
# Sales - Weekly Performance
curl -X GET "http://localhost:3000/sales-target/performance/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sales - Per Customer
curl -X GET "http://localhost:3000/sales-target/sales-per-customer/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sales - Per Product
curl -X GET "http://localhost:3000/sales-target/sales-per-product/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sales - Summary
curl -X GET "http://localhost:3000/sales-target/sales-summary/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Procurement - Weekly Performance
curl -X GET "http://localhost:3000/procurement-target/performance/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Procurement - Per Product
curl -X GET "http://localhost:3000/procurement-target/procurement-per-product/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Procurement - Summary
curl -X GET "http://localhost:3000/procurement-target/procurement-summary/emp123/1/2025" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript/Axios Examples

```javascript
// Sales - Weekly Performance
const salesPerformance = await axios.get(
  `/sales-target/performance/${employeeId}/${month}/${year}`,
  { params: { customerId, productId } }
);

// Sales - Per Customer
const salesPerCustomer = await axios.get(
  `/sales-target/sales-per-customer/${employeeId}/${month}/${year}`
);

// Sales - Per Product
const salesPerProduct = await axios.get(
  `/sales-target/sales-per-product/${employeeId}/${month}/${year}`
);

// Sales - Summary
const salesSummary = await axios.get(
  `/sales-target/sales-summary/${employeeId}/${month}/${year}`
);

// Procurement - Weekly Performance
const procurementPerformance = await axios.get(
  `/procurement-target/performance/${employeeId}/${month}/${year}`,
  { params: { productId } }
);

// Procurement - Per Product
const procurementPerProduct = await axios.get(
  `/procurement-target/procurement-per-product/${employeeId}/${month}/${year}`
);

// Procurement - Summary
const procurementSummary = await axios.get(
  `/procurement-target/procurement-summary/${employeeId}/${month}/${year}`
);
```

---

## 🔐 Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## ⚡ Performance Tips

1. **Cache Results**: Summary data changes infrequently, consider caching
2. **Batch Requests**: If fetching multiple months, consider creating a batch endpoint
3. **Pagination**: For large datasets, implement pagination (future enhancement)
4. **Indexes**: Ensure database indexes on `employee_id`, `month`, `year`

---

## 🐛 Common Issues & Solutions

### Issue: Empty Data Response
**Solution**: Verify that:
- Employee ID exists
- Target has been created for that month/year
- Month is 1-12 (not 0-11)

### Issue: Incorrect Percentages
**Solution**: Check that:
- Achievements are linked to correct weekly targets
- Weekly targets are linked to correct product targets
- Product targets are linked to correct monthly targets

### Issue: Missing Customer/Product Names
**Solution**: Ensure:
- Relations are properly loaded in queries
- Customer/Product entities exist and are not deleted

---

## 📚 Related Documentation

- [Sales Summary API Details](./SALES_SUMMARY_API.md)
- [Procurement Summary API Details](./PROCUREMENT_SUMMARY_API.md)
- [API Summary & Comparison](./API_SUMMARY.md)
- [Main API Documentation](./API_ENDPOINT_DOCUMENTATION.md)
