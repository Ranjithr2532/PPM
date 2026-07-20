-- Migration: Add updated_at and updated_by columns to payments table
-- Run this SQL to add the new columns for tracking payment edits

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updated_by VARCHAR DEFAULT NULL;

-- Note: The payments table already has created_at and updated_at columns
-- This migration adds the updated_by column which was missing

-- After running this migration, the Edit payment route will:
-- 1. Automatically set updated_at to current timestamp when editing
-- 2. Automatically set updated_by to the current user's name when editing
