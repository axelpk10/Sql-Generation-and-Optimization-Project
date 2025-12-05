"""
Context Manager for Redis-based Project Context Storage
Handles all project context operations: metadata, schema, AI, query intents
"""

import json
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from redis_client import get_redis_client, is_redis_available

logger = logging.getLogger(__name__)

# TTL Configuration (in seconds)
SCHEMA_TTL = 3600           # 1 hour - Schema cache
AI_CONTEXT_TTL = 604800     # 7 days - AI conversations
QUERY_INTENTS_TTL = 2592000 # 30 days - Query history

# Max Limits
MAX_QUERY_INTENTS = 50      # Last 50 queries per project
MAX_AI_MESSAGES = 100       # Last 100 AI messages per session
MAX_AI_SESSIONS = 10        # Last 10 AI chat sessions per project


class ContextManager:
    """Manages all project context operations with Redis"""
    
    def __init__(self):
        self.redis = get_redis_client()
    
    def _is_available(self) -> bool:
        """Check if Redis is available"""
        return is_redis_available()
    
    def _safe_operation(self, operation_name: str, operation_func, default_return=None):
        """Execute operation with error handling (fail gracefully)"""
        if not self._is_available():
            logger.warning(f"⚠️  Redis unavailable for {operation_name}, returning default")
            return default_return
        
        try:
            return operation_func()
        except Exception as e:
            logger.error(f"❌ Error in {operation_name}: {e}")
            return default_return
    
    # ============================================
    # PROJECT METADATA OPERATIONS
    # ============================================
    
    def save_project_metadata(self, project: Dict[str, Any]) -> bool:
        """Save project metadata (no TTL - persistent)"""
        def operation():
            project_id = project['id']
            key = f"project:{project_id}:metadata"
            self.redis.set(key, json.dumps(project))
            logger.info(f"✅ Saved project metadata: {project_id}")
            return True
        
        return self._safe_operation("save_project_metadata", operation, False)
    
    def get_project_metadata(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project metadata"""
        def operation():
            key = f"project:{project_id}:metadata"
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        
        return self._safe_operation("get_project_metadata", operation, None)
    
    def update_project_metadata(self, project_id: str, updates: Dict[str, Any]) -> bool:
        """Update project metadata"""
        def operation():
            project = self.get_project_metadata(project_id)
            if project:
                project.update(updates)
                project['updatedAt'] = datetime.now().isoformat()
                return self.save_project_metadata(project)
            return False
        
        return self._safe_operation("update_project_metadata", operation, False)
    
    def delete_project(self, project_id: str) -> bool:
        """Delete all project data"""
        def operation():
            # Get all keys for this project
            pattern = f"project:{project_id}:*"
            keys = self.redis.keys(pattern)
            
            if keys:
                self.redis.delete(*keys)
                logger.info(f"🗑️  Deleted {len(keys)} keys for project {project_id}")
            
            return True
        
        return self._safe_operation("delete_project", operation, False)
    
    def list_all_projects(self) -> List[Dict[str, Any]]:
        """List all projects"""
        def operation():
            pattern = "project:*:metadata"
            keys = self.redis.keys(pattern)
            projects = []
            
            for key in keys:
                data = self.redis.get(key)
                if data:
                    projects.append(json.loads(data))
            
            return projects
        
        return self._safe_operation("list_all_projects", operation, [])
    
    # ============================================
    # SCHEMA CACHE OPERATIONS
    # ============================================
    
    def save_schema(self, project_id: str, schema: Dict[str, Any], ttl: int = SCHEMA_TTL) -> bool:
        """Save schema with TTL"""
        def operation():
            key = f"project:{project_id}:schema"
            schema_data = {
                **schema,
                'lastSynced': datetime.now().isoformat()
            }
            self.redis.setex(key, ttl, json.dumps(schema_data))
            logger.info(f"✅ Saved schema for project {project_id} (TTL: {ttl}s)")
            return True
        
        return self._safe_operation("save_schema", operation, False)
    
    def get_schema(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get cached schema"""
        def operation():
            key = f"project:{project_id}:schema"
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        
        return self._safe_operation("get_schema", operation, None)
    
    def invalidate_schema(self, project_id: str) -> bool:
        """Invalidate schema cache"""
        def operation():
            key = f"project:{project_id}:schema"
            self.redis.delete(key)
            logger.info(f"🔄 Invalidated schema cache for project {project_id}")
            return True
        
        return self._safe_operation("invalidate_schema", operation, False)
    
    # ============================================
    # AI CONTEXT OPERATIONS
    # ============================================
    
    def save_ai_message(self, project_id: str, session_id: str, message: Dict[str, Any]) -> bool:
        """Save AI message to conversation"""
        def operation():
            key = f"project:{project_id}:ai:session:{session_id}"
            
            # Get existing session or create new
            data = self.redis.get(key)
            if data:
                session = json.loads(data)
            else:
                session = {
                    'sessionId': session_id,
                    'messages': [],
                    'createdAt': datetime.now().isoformat()
                }
            
            # Add message
            session['messages'].append(message)
            session['lastMessageAt'] = datetime.now().isoformat()
            
            # Trim to max messages
            if len(session['messages']) > MAX_AI_MESSAGES:
                session['messages'] = session['messages'][-MAX_AI_MESSAGES:]
            
            # Save with TTL
            self.redis.setex(key, AI_CONTEXT_TTL, json.dumps(session))
            logger.info(f"✅ Saved AI message to session {session_id}")
            return True
        
        return self._safe_operation("save_ai_message", operation, False)
    
    def get_ai_session(self, project_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """Get AI conversation session"""
        def operation():
            key = f"project:{project_id}:ai:session:{session_id}"
            data = self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        
        return self._safe_operation("get_ai_session", operation, None)
    
    def delete_ai_session(self, project_id: str, session_id: str) -> bool:
        """Delete AI conversation session (clear chat history)"""
        def operation():
            key = f"project:{project_id}:ai:session:{session_id}"
            result = self.redis.delete(key)
            return result > 0  # Returns True if key was deleted
        
        return self._safe_operation("delete_ai_session", operation, False)
    
    def list_ai_sessions(self, project_id: str) -> List[Dict[str, Any]]:
        """List all AI sessions for project"""
        def operation():
            pattern = f"project:{project_id}:ai:session:*"
            keys = self.redis.keys(pattern)
            sessions = []
            
            for key in keys:
                data = self.redis.get(key)
                if data:
                    session = json.loads(data)
                    # Return metadata only (without full messages for listing)
                    sessions.append({
                        'sessionId': session['sessionId'],
                        'messageCount': len(session.get('messages', [])),
                        'createdAt': session.get('createdAt'),
                        'lastMessageAt': session.get('lastMessageAt')
                    })
            
            return sessions[-MAX_AI_SESSIONS:]  # Return last N sessions
        
        return self._safe_operation("list_ai_sessions", operation, [])
    
    def delete_ai_session(self, project_id: str, session_id: str) -> bool:
        """Delete AI session"""
        def operation():
            key = f"project:{project_id}:ai:session:{session_id}"
            self.redis.delete(key)
            logger.info(f"🗑️  Deleted AI session {session_id}")
            return True
        
        return self._safe_operation("delete_ai_session", operation, False)
    
    # ============================================
    # QUERY INTENTS OPERATIONS
    # ============================================
    
    def save_query_intent(self, project_id: str, intent: Dict[str, Any]) -> bool:
        """Save query intent (NO RESULTS!)"""
        def operation():
            key = f"project:{project_id}:intents"
            
            # Add to list (LPUSH adds to beginning)
            self.redis.lpush(key, json.dumps(intent))
            
            # Trim to max size
            self.redis.ltrim(key, 0, MAX_QUERY_INTENTS - 1)
            
            # Set TTL if not already set
            if self.redis.ttl(key) == -1:
                self.redis.expire(key, QUERY_INTENTS_TTL)
            
            logger.info(f"✅ Saved query intent for project {project_id}")
            return True
        
        return self._safe_operation("save_query_intent", operation, False)
    
    def get_query_intents(self, project_id: str, limit: int = MAX_QUERY_INTENTS) -> List[Dict[str, Any]]:
        """Get recent query intents"""
        def operation():
            key = f"project:{project_id}:intents"
            intents_json = self.redis.lrange(key, 0, limit - 1)
            intents = [json.loads(intent) for intent in intents_json]
            return intents
        
        return self._safe_operation("get_query_intents", operation, [])
    
    def clear_query_intents(self, project_id: str) -> bool:
        """Clear all query intents for project"""
        def operation():
            key = f"project:{project_id}:intents"
            self.redis.delete(key)
            logger.info(f"🗑️  Cleared query intents for project {project_id}")
            return True
        
        return self._safe_operation("clear_query_intents", operation, False)
    
    # ============================================
    # UTILITY OPERATIONS
    # ============================================
    
    def get_project_stats(self, project_id: str) -> Dict[str, Any]:
        """Get project statistics"""
        def operation():
            stats = {
                'projectId': project_id,
                'hasMetadata': bool(self.get_project_metadata(project_id)),
                'hasSchema': bool(self.get_schema(project_id)),
                'aiSessionCount': len(self.list_ai_sessions(project_id)),
                'queryIntentCount': len(self.get_query_intents(project_id)),
                'timestamp': datetime.now().isoformat()
            }
            return stats
        
        return self._safe_operation("get_project_stats", operation, {
            'projectId': project_id,
            'error': 'Redis unavailable'
        })
    
    def health_check(self) -> Dict[str, Any]:
        """Health check for Redis connection"""
        if not self._is_available():
            return {
                'status': 'unavailable',
                'message': 'Redis connection failed'
            }
        
        try:
            info = self.redis.info()
            return {
                'status': 'healthy',
                'redis_version': info.get('redis_version'),
                'used_memory_human': info.get('used_memory_human'),
                'connected_clients': info.get('connected_clients'),
                'uptime_in_seconds': info.get('uptime_in_seconds')
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
