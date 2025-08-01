-- Enable RLS on emails table
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to perform all operations (for backend operations)
CREATE POLICY "Service role can manage all emails" ON public.emails
    FOR ALL USING (true)
    WITH CHECK (true);

-- Policy to allow users to view their own emails
CREATE POLICY "Users can view their own emails" ON public.emails
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy to allow users to update their own emails
CREATE POLICY "Users can update their own emails" ON public.emails
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policy to allow users to delete their own emails
CREATE POLICY "Users can delete their own emails" ON public.emails
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Alternative: If you want to disable RLS for the emails table (less secure but simpler)
-- ALTER TABLE public.emails DISABLE ROW LEVEL SECURITY; 