"""
Redis Client for Project Context Management
Singleton pattern for Redis connection
"""

import redis
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class RedisClient:
    """Singleton Redis client for project context storage"""
    
    _instance: Optional[redis.Redis] = None
    _initialized = False
    
    @classmethod
    def get_client(cls) -> Optional[redis.Redis]:
        """Get Redis client instance (singleton pattern)"""
        if cls._instance is None:
            try:
                redis_host = os.getenv('REDIS_HOST', 'localhost')
                redis_port = int(os.getenv('REDIS_PORT', 6379))
                redis_db = int(os.getenv('REDIS_DB', 0))
                redis_password = os.getenv('REDIS_PASSWORD', None)
                
                cls._instance = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password,
                    decode_responses=True,  # Auto-decode to strings
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True
                )
                
                # Test connection
                cls._instance.ping()
                cls._initialized = True
                logger.info(f"✅ Redis connected successfully: {redis_host}:{redis_port} (DB: {redis_db})")
                
            except redis.ConnectionError as e:
                logger.error(f"❌ Redis connection failed: {e}")
                logger.warning("⚠️  Running without Redis - context features disabled")
                cls._instance = None
                cls._initialized = False
            except Exception as e:
                logger.error(f"❌ Unexpected Redis error: {e}")
                cls._instance = None
                cls._initialized = False
        
        return cls._instance
    
    @classmethod
    def is_available(cls) -> bool:
        """Check if Redis is available"""
        if not cls._initialized:
            cls.get_client()
        
        if cls._instance is None:
            return False
        
        try:
            cls._instance.ping()
            return True
        except:
            return False
    
    @classmethod
    def reset(cls):
        """Reset connection (for testing)"""
        if cls._instance:
            try:
                cls._instance.close()
            except:
                pass
        cls._instance = None
        cls._initialized = False


def get_redis_client() -> Optional[redis.Redis]:
    """Convenience function to get Redis client"""
    return RedisClient.get_client()


def is_redis_available() -> bool:
    """Check if Redis is available"""
    return RedisClient.is_available()
