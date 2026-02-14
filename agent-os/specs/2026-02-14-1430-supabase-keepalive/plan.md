# Supabase Keep-Alive — Implementation Plan

See `/Users/eyalrosenfeld_p4p/.claude/plans/mossy-knitting-creek.md` for the full plan.

## Summary

- Background scheduler pings Supabase projects every 6 hours
- Admin UI to manage projects (add/remove/toggle/manual ping)
- Service keys encrypted at rest (AES-256-GCM)
- 12 new files, 2 modified files, 1 SQL migration
