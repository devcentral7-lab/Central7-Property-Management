-- Legacy "Status Update" actions that the original enum did not cover. Kept
-- verbatim so imported history reads the same as it did in the old system.
alter type public.activity_action add value if not exists 'Social Media Requested';
alter type public.activity_action add value if not exists 'LPW Publish Requested';
alter type public.activity_action add value if not exists 'Published on TikTok';
alter type public.activity_action add value if not exists 'Data Change Acknowledged';
