-- ============================================
-- TRINO FEDERATION DEMO QUERIES
-- Cross-Database Analytics (MySQL + PostgreSQL)
-- ============================================
-- Project IDs:
--   MySQL (Sales): proj_8d658e38_
--   PostgreSQL (Analytics): proj_a4e46f40_
-- ============================================

-- QUERY 1: Customer Lifetime Value Analysis
-- Join PostgreSQL analytics with MySQL transactional data
-- Shows high-value customers with their recent orders
SELECT 
    cm.customer_id,
    cm.customer_name,
    cm.lifetime_value,
    cm.total_orders AS analytics_total_orders,
    cm.avg_order_value,
    o.order_id,
    o.order_date,
    o.total_amount,
    o.order_status,
    o.shipping_address
FROM 
    postgresql.public.proj_a4e46f40_customer_metrics cm
INNER JOIN 
    mysql.sales.proj_8d658e38_orders o
    ON cm.customer_id = o.customer_id
WHERE 
    cm.lifetime_value > 2000
ORDER BY 
    cm.lifetime_value DESC, 
    o.order_date DESC
LIMIT 20;

-- ============================================

-- QUERY 2: Product Performance Deep Dive
-- Compare PostgreSQL product analytics with real-time MySQL inventory
-- Shows top products by revenue with current stock status
SELECT 
    pp.product_id,
    pp.product_name,
    pp.category,
    pp.total_revenue,
    pp.units_sold,
    pp.revenue_rank,
    p.price AS current_price,
    p.stock_quantity AS current_stock,
    ROUND(pp.total_revenue / NULLIF(pp.units_sold, 0), 2) AS avg_sale_price,
    CASE 
        WHEN p.stock_quantity < 10 THEN 'Low Stock'
        WHEN p.stock_quantity < 50 THEN 'Medium Stock'
        ELSE 'High Stock'
    END AS stock_status
FROM 
    postgresql.public.proj_a4e46f40_product_performance pp
INNER JOIN 
    mysql.sales.proj_8d658e38_products p
    ON pp.product_id = p.product_id
WHERE 
    pp.revenue_rank <= 10
ORDER BY 
    pp.revenue_rank ASC;

-- ============================================

-- QUERY 3: Daily Sales Reconciliation
-- Cross-validate PostgreSQL daily metrics with actual MySQL orders
-- Identifies any data inconsistencies between systems
WITH mysql_daily_sales AS (
    SELECT 
        CAST(order_date AS DATE) AS sale_date,
        COUNT(*) AS actual_order_count,
        SUM(total_amount) AS actual_revenue,
        ROUND(AVG(total_amount), 2) AS actual_avg_order
    FROM 
        mysql.sales.proj_8d658e38_orders
    WHERE 
        order_status IN ('delivered', 'shipped')
    GROUP BY 
        CAST(order_date AS DATE)
)
SELECT 
    sm.metric_date,
    sm.total_revenue AS analytics_revenue,
    mds.actual_revenue,
    ROUND(sm.total_revenue - mds.actual_revenue, 2) AS revenue_diff,
    sm.order_count AS analytics_orders,
    mds.actual_order_count,
    sm.order_count - mds.actual_order_count AS order_count_diff,
    sm.avg_basket_size AS analytics_avg_basket,
    mds.actual_avg_order,
    ROUND(sm.total_revenue / NULLIF(sm.order_count, 0), 2) AS analytics_calculated_avg,
    CASE 
        WHEN ABS(sm.total_revenue - mds.actual_revenue) < 1 THEN 'MATCH'
        WHEN ABS(sm.total_revenue - mds.actual_revenue) < 100 THEN 'MINOR_DIFF'
        ELSE 'MAJOR_DIFF'
    END AS reconciliation_status
FROM 
    postgresql.public.proj_a4e46f40_sales_metrics sm
INNER JOIN 
    mysql_daily_sales mds
    ON sm.metric_date = mds.sale_date
ORDER BY 
    sm.metric_date DESC
LIMIT 20;

-- ============================================

-- QUERY 4: Customer Segmentation with Order Behavior
-- Enrich PostgreSQL customer segments with MySQL order patterns
-- Shows segment characteristics and recent purchase activity
SELECT 
    cm.customer_id,
    cm.customer_name,
    cm.lifetime_value,
    CASE 
        WHEN cm.lifetime_value >= 2100 THEN 'High Value'
        WHEN cm.lifetime_value >= 1700 THEN 'Regular'
        ELSE 'New'
    END AS segment,
    COUNT(o.order_id) AS total_orders,
    SUM(o.total_amount) AS total_order_value,
    MAX(o.order_date) AS last_order_date,
    MIN(o.order_date) AS first_order_date,
    ARRAY_AGG(DISTINCT o.order_status) AS order_statuses
FROM 
    postgresql.public.proj_a4e46f40_customer_metrics cm
LEFT JOIN 
    mysql.sales.proj_8d658e38_orders o
    ON cm.customer_id = o.customer_id
GROUP BY 
    cm.customer_id,
    cm.customer_name,
    cm.lifetime_value
ORDER BY 
    cm.lifetime_value DESC,
    total_orders DESC
LIMIT 30;

-- ============================================

-- QUERY 5: Executive Dashboard - Complete Business Overview
-- UNION of key metrics from both PostgreSQL analytics and MySQL operational data
-- Provides a unified view of business performance
WITH revenue_summary AS (
    SELECT 
        'Monthly Revenue Trend' AS metric_category,
        period_label AS metric_name,
        revenue AS metric_value,
        'PostgreSQL Analytics' AS data_source
    FROM 
        postgresql.public.proj_a4e46f40_revenue_trends
    ORDER BY 
        trend_date DESC
    LIMIT 3
),
segment_summary AS (
    SELECT 
        'Customer Segments' AS metric_category,
        segment_name AS metric_name,
        (avg_revenue_per_customer * customer_count) AS metric_value,
        'PostgreSQL Analytics' AS data_source
    FROM 
        postgresql.public.proj_a4e46f40_customer_segments
),
payment_summary AS (
    SELECT 
        'Payment Methods' AS metric_category,
        payment_method AS metric_name,
        SUM(payment_amount) AS metric_value,
        'MySQL Transactions' AS data_source
    FROM 
        mysql.sales.proj_8d658e38_payments
    WHERE 
        payment_status = 'success'
    GROUP BY 
        payment_method
),
order_status_summary AS (
    SELECT 
        'Order Status' AS metric_category,
        order_status AS metric_name,
        SUM(total_amount) AS metric_value,
        'MySQL Transactions' AS data_source
    FROM 
        mysql.sales.proj_8d658e38_orders
    GROUP BY 
        order_status
)
SELECT 
    metric_category,
    metric_name,
    ROUND(metric_value, 2) AS metric_value,
    data_source,
    CASE 
        WHEN metric_category IN ('Monthly Revenue Trend', 'Customer Segments') THEN 'Strategic'
        ELSE 'Operational'
    END AS metric_level
FROM (
    SELECT * FROM revenue_summary
    UNION ALL
    SELECT * FROM segment_summary
    UNION ALL
    SELECT * FROM payment_summary
    UNION ALL
    SELECT * FROM order_status_summary
) combined_metrics
ORDER BY 
    metric_category,
    metric_value DESC;

-- ============================================
-- END OF FEDERATION QUERIES
-- ============================================

-- BONUS QUERY: Real-time Product Basket Analysis
-- Shows which products are frequently ordered together (MySQL)
-- Enriched with PostgreSQL performance metrics
SELECT 
    pp1.product_name AS product_1,
    pp1.category AS category_1,
    pp1.total_revenue AS product_1_revenue,
    pp2.product_name AS product_2,
    pp2.category AS category_2,
    pp2.total_revenue AS product_2_revenue,
    COUNT(*) AS times_ordered_together,
    SUM(oi1.quantity + oi2.quantity) AS total_units
FROM 
    mysql.sales.proj_8d658e38_order_items oi1
INNER JOIN 
    mysql.sales.proj_8d658e38_order_items oi2
    ON oi1.order_id = oi2.order_id 
    AND oi1.product_id < oi2.product_id
INNER JOIN 
    postgresql.public.proj_a4e46f40_product_performance pp1
    ON oi1.product_id = pp1.product_id
INNER JOIN 
    postgresql.public.proj_a4e46f40_product_performance pp2
    ON oi2.product_id = pp2.product_id
GROUP BY 
    pp1.product_name,
    pp1.category,
    pp1.total_revenue,
    pp2.product_name,
    pp2.category,
    pp2.total_revenue
HAVING 
    COUNT(*) >= 3
ORDER BY 
    times_ordered_together DESC,
    total_units DESC
LIMIT 15;
