# Sales Target Performance Endpoint

## New Endpoint Added

### GET `/sales-target/performance/:employeeId/:month/:year`

This endpoint retrieves target performance metrics for a specific employee, with optional filtering by customer and product.

#### Path Parameters (All Required)

- `employeeId` (string, required): The ID of the employee
- `month` (number, required): The month (0-11, where 0 = January, 11 = December)
- `year` (number, required): The year (e.g., 2026)

#### Query Parameters (Optional)

- `customerId` (string, optional): The ID of the customer to filter by. If not provided, aggregates all customers.
- `productId` (string, optional): The ID of the product to filter by. If not provided, aggregates all products.

#### Example Requests

**Get performance for all customers and products (January 2026):**
```http
GET /sales-target/performance/emp456/0/2026
```

**Get performance for a specific customer (all products) (December 2026):**
```http
GET /sales-target/performance/emp456/11/2026?customerId=abc123
```

**Get performance for a specific product (all customers) (June 2026):**
```http
GET /sales-target/performance/emp456/5/2026?productId=xyz789
```

**Get performance for a specific customer and product (March 2026):**
```http
GET /sales-target/performance/emp456/2/2026?customerId=abc123&productId=xyz789
```

#### Response Format

The endpoint returns an array of weekly performance data:

```json
{
  "success": true,
  "data": [
    {
      "Period": "week 1",
      "targetAssigned": 5000,
      "targetAchieved": 4500,
      "percentage": "90%",
      "variance": -500
    },
    {
      "Period": "week 2",
      "targetAssigned": 5000,
      "targetAchieved": 4500,
      "percentage": "90%",
      "variance": -500
    },
    {
      "Period": "week 3",
      "targetAssigned": 5000,
      "targetAchieved": 4800,
      "percentage": "96%",
      "variance": -200
    },
    {
      "Period": "week 4",
      "targetAssigned": 5000,
      "targetAchieved": 5200,
      "percentage": "104%",
      "variance": 200
    }
  ]
}
```

**Empty result when no data found:**
```json
{
  "success": true,
  "data": []
}
```

#### Response Fields

Each object in the array represents one week's performance:

- `Period`: Week identifier (e.g., "week 1", "week 2", "week 3", "week 4")
- `targetAssigned`: Target amount assigned for this specific week
- `targetAchieved`: Amount achieved for this specific week
- `percentage`: Achievement percentage for this week as a string with % symbol (e.g., "90%")
- `variance`: Difference between achieved and assigned for this week (positive = over-achieved, negative = under-achieved)

#### Error Responses

**404 Not Found** - Entity not found
```json
{
  "success": false,
  "message": "Employee not found"
}
```

#### Notes

- If no sales target exists for the given parameters, the endpoint returns zeros for all metrics
- When `customerId` and `productId` are not provided, the endpoint aggregates data across all customers and products
- When only `customerId` is provided, it aggregates across all products for that customer
- When only `productId` is provided, it aggregates across all customers for that product
- The calculation aggregates all weekly targets and achievements for the specified month/year
- Variance is calculated as: `targetAchieved - targetAssigned`
  - Positive variance = Over-achieved
  - Negative variance = Under-achieved
  - Zero variance = Exactly met target

---

## Sales Per Customer Endpoint

### GET `/sales-target/sales-per-customer/:employeeId/:month/:year`

This endpoint retrieves sales performance aggregated by customer for a specific employee and time period.

#### Path Parameters (All Required)

- `employeeId` (string, required): The ID of the employee
- `month` (number, required): The month (0-11, where 0 = January, 11 = December)
- `year` (number, required): The year (e.g., 2026)

#### Example Request

```http
GET /sales-target/sales-per-customer/7ec212e8-2cd0-4177-8128-4c7c664ca03d/0/2026
```

#### Response Format

The endpoint returns an array of customer performance data:

```json
{
  "success": true,
  "data": [
    {
      "Customer Name": "abc exporters",
      "targetAssigned": 5000,
      "targetAchieved": 4500,
      "percentage": 90,
      "variance": -500
    },
    {
      "Customer Name": "xyz traders",
      "targetAssigned": 5000,
      "targetAchieved": 4500,
      "percentage": 90,
      "variance": -500
    }
  ]
}
```

**Empty result when no data found:**
```json
{
  "success": true,
  "data": []
}
```

#### Response Fields

Each object in the array represents one customer's performance:

- `Customer Name`: Name of the customer organization
- `targetAssigned`: Total target amount assigned for this customer across all products
- `targetAchieved`: Total amount achieved for this customer across all products
- `percentage`: Achievement percentage as a number (e.g., 90 for 90%)
- `variance`: Difference between achieved and assigned (positive = over-achieved, negative = under-achieved)

#### Error Responses

**404 Not Found** - Entity not found
```json
{
  "success": false,
  "message": "Employee not found"
}
```

#### Notes

- The endpoint aggregates all products for each customer
- Customers are sorted alphabetically by name
- If no sales target exists for the given parameters, returns an empty array
- Month format: 0 = January, 11 = December
