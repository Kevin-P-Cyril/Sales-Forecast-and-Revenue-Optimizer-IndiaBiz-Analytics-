# create_database.py — IndiaBiz Analytics v4.0
# Creates the database schema. NO default products inserted.
# Products must be added by users via the admin panel.

import sqlite3, hashlib

def create_database():
    print("=" * 55)
    print("  INDIABIZ ANALYTICS v4.0 — DATABASE SETUP")
    print("=" * 55)

    conn = sqlite3.connect('sales_forecasting.db')
    c = conn.cursor()

    print("\n📊 Creating tables...")

    c.executescript('''
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        business_type TEXT NOT NULL,
        gstin TEXT, pan_number TEXT,
        state TEXT NOT NULL,
        city TEXT NOT NULL,
        authorized_person TEXT NOT NULL,
        mobile_number TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        mobile_number TEXT,
        full_name TEXT NOT NULL,
        age INTEGER,
        designation TEXT,
        department TEXT,
        role TEXT DEFAULT 'user',
        is_active BOOLEAN DEFAULT 1,
        reset_token TEXT,
        reset_token_expiry DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        company_name TEXT,
        description TEXT,
        category TEXT DEFAULT 'General',
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        image_url TEXT, image_data TEXT,
        sku TEXT, size TEXT, color TEXT, brand TEXT,
        cost REAL,
        min_stock_level INTEGER DEFAULT 10,
        state TEXT,
        district TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        state TEXT,
        district TEXT,
        invoice_number TEXT,
        customer_name TEXT,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        revenue REAL NOT NULL,
        sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS forecast (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        product_id INTEGER,
        forecast_value REAL NOT NULL,
        forecast_date DATE NOT NULL,
        forecast_period TEXT NOT NULL DEFAULT '30d',
        actual_value REAL DEFAULT 0,
        actual_revenue REAL DEFAULT 0,
        confidence_interval REAL,
        is_optimized BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS optimization_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        company_id INTEGER,
        previous_value REAL NOT NULL,
        optimized_value REAL NOT NULL,
        corrected_error REAL,
        error_reduction_pct REAL,
        method TEXT DEFAULT 'weighted_moving_average',
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_optimizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        current_price REAL NOT NULL,
        suggested_price REAL NOT NULL,
        recommendation TEXT,
        is_applied BOOLEAN DEFAULT 0,
        applied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(company_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_state ON sales(state);
    CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
    CREATE INDEX IF NOT EXISTS idx_products_state ON products(state);
    CREATE INDEX IF NOT EXISTS idx_forecast_company ON forecast(company_id);
    CREATE INDEX IF NOT EXISTS idx_forecast_product ON forecast(product_id);
    ''')

    print("✅ All tables created!")

    # Check if admin already exists
    c.execute("SELECT id FROM companies WHERE email='admin@indiabiz.com'")
    if not c.fetchone():
        c.execute('''INSERT INTO companies
            (name,email,business_type,state,city,authorized_person,mobile_number)
            VALUES (?,?,?,?,?,?,?)''',
            ('IndiaBiz Analytics HQ','admin@indiabiz.com','Service',
             'Maharashtra','Mumbai','System Admin','0000000000'))
        cid = c.lastrowid
        ahash = hashlib.sha256("Admin@123".encode()).hexdigest()
        c.execute('''INSERT INTO users
            (company_id,username,email,password_hash,full_name,role)
            VALUES (?,?,?,?,?,?)''',
            (cid,'admin','admin@indiabiz.com',ahash,'System Administrator','admin'))
        conn.commit()
        print("✅ Admin account created: admin / Admin@123")
    else:
        print("ℹ️  Admin already exists — skipping")

    conn.commit()

    # Print stats
    print("\n" + "=" * 55)
    print("  DATABASE STATISTICS")
    print("=" * 55)
    for table in ['companies','users','products','sales','forecast','optimization_log']:
        c.execute(f'SELECT COUNT(*) FROM {table}')
        print(f"  {table:25s}: {c.fetchone()[0]} rows")

    print("\n" + "=" * 55)
    print("  ADMIN LOGIN CREDENTIALS")
    print("=" * 55)
    print("  Username : admin")
    print("  Password : Admin@123")
    print("  URL      : http://localhost:5000")
    print("\n  NOTE: Products must be added by users.")
    print("        No default/hardcoded products exist.")
    print("=" * 55)
    conn.close()
    print("\n✅ DATABASE READY!\n")

if __name__ == "__main__":
    create_database()
