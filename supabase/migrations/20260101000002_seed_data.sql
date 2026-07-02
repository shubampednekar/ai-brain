-- Seed data: intent categories and feature flags

INSERT INTO intent_categories (slug, name, description, icon, color, sort_order) VALUES
  ('reminder', 'Reminder', 'Time-based reminders and alerts', 'bell', '#f59e0b', 1),
  ('memory', 'Memory', 'General knowledge and facts to remember', 'brain', '#6366f1', 2),
  ('task', 'Task', 'Action items and to-dos', 'check-square', '#10b981', 3),
  ('idea', 'Idea', 'Creative thoughts and concepts', 'lightbulb', '#8b5cf6', 4),
  ('preference', 'Preference', 'Personal preferences and likes/dislikes', 'heart', '#ec4899', 5),
  ('meeting', 'Meeting', 'Meetings and appointments', 'calendar', '#3b82f6', 6),
  ('shopping', 'Shopping', 'Shopping lists and purchases', 'shopping-cart', '#14b8a6', 7),
  ('decision', 'Decision', 'Important decisions made', 'gavel', '#ef4444', 8),
  ('approval', 'Approval', 'Approvals and rejections', 'thumbs-up', '#22c55e', 9),
  ('requirement', 'Requirement', 'Project requirements and specifications', 'file-text', '#64748b', 10),
  ('question', 'Question', 'Questions needing answers', 'help-circle', '#a855f7', 11);

INSERT INTO feature_flags (slug, name, description, is_enabled) VALUES
  ('shared_memory', 'Shared Memory', 'Enable shared workspace features', true),
  ('analytics', 'Analytics', 'Enable usage analytics', false),
  ('voice_notes', 'Voice Notes', 'Enable voice note capture', false),
  ('browser_extension', 'Browser Extension', 'Enable browser extension', false),
  ('research_agent', 'Research Agent', 'Enable internet research agent', false),
  ('daily_digest', 'Daily Digest', 'Enable daily email digest', false);
