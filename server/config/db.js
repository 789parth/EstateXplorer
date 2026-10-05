const mongoose = require('mongoose');
const dns = require('dns');

// Configure fast, reliable public DNS servers (Google & Cloudflare)
// This permanently eliminates `querySrv ETIMEOUT` on Windows/ISP networks
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (e) {
  // Ignore in environments where custom DNS servers are restricted
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// Direct replica set URI that completely bypasses SRV DNS resolution
const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const fallbackDirectUri = process.env.MONGODB_DIRECT_URI;
  const primaryUri = process.env.MONGODB_URI || fallbackDirectUri;
  if (!primaryUri) {
    throw new Error('Database configuration is missing. Set MONGODB_URI or MONGODB_DIRECT_URI.');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to prevent IPv6 DNS timeout delays on Windows
      minPoolSize: 5,
      maxPoolSize: 20,
      maxIdleTimeMS: 30000,
    };

    cached.promise = (async () => {
      try {
        const instance = await mongoose.connect(primaryUri, opts);
        console.log(`MongoDB Connected to Atlas: ${instance.connection.host}`);
        return instance;
      } catch (err) {
        console.warn(`Primary connection attempt encountered issue (${err.message}). Connecting via Direct Replica Set...`);
        if (fallbackDirectUri && primaryUri !== fallbackDirectUri) {
          const directInstance = await mongoose.connect(fallbackDirectUri, opts);
          console.log(`MongoDB Connected via Direct Replica Set: ${directInstance.connection.host}`);
          return directInstance;
        }
        throw err;
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB Connection Error:', e.message);
    throw e;
  }

  return cached.conn;
};

module.exports = connectDB;
