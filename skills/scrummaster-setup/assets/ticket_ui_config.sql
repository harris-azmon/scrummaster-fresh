-- Scrummaster fossil ticket UI configuration
--
-- ticket_schema.sql adds Scrummaster's own columns (epic_id, story_id, acid,
-- component, acai_status, ...) to the ticket table. That covers programmatic
-- access, but leaves Fossil's own built-in `status` field (the one shown in
-- `fossil ui`'s ticket entry/edit/view forms and the stock "All Tickets"
-- report) configured with generic bug-tracker jargon (Open/Verified/Review/
-- Deferred/Fixed/Tested/Closed) that doesn't match an ACID's lifecycle. This
-- file replaces just the status dropdown so a ticket opened in `fossil ui`
-- reads sensibly, without touching type/priority/severity/resolution or any
-- of the ticket entry/view/edit page templates (they reference
-- $status_choices etc. by variable, so this alone is enough to update them).
--
-- `acai_status` (assigned/blocked/incomplete/completed/rejected/accepted)
-- remains the richer, authoritative vocabulary that `acid push`/`acid
-- set-status` and scrummaster-review's ACID cross-check actually read;
-- Fossil's native `status` here is kept in the same spirit for humans
-- browsing `fossil ui` directly, and "Open"/"Closed" are kept as literal
-- values since mcp/src/fossil.ts falls back to `status === 'Closed'` when
-- acai_status is unset.
--
-- Apply once per repository, right after ticket_schema.sql:
--   fossil sql < templates/fossil/ticket_ui_config.sql

REPLACE INTO config(name, value, mtime) VALUES ('ticket-common', 'set type_choices {
   Code_Defect
   Build_Problem
   Documentation
   Feature_Request
   Incident
}
set priority_choices {
  Immediate
  High
  Medium
  Low
  Zero
}
set severity_choices {
  Critical
  Severe
  Important
  Minor
  Cosmetic
}
set resolution_choices {
  Open
  Fixed
  Rejected
  Workaround
  Unable_To_Reproduce
  Works_As_Designed
  External_Bug
  Not_A_Bug
  Duplicate
  Overcome_By_Events
  Drive_By_Patch
  Misconfiguration
}
set status_choices {
  Open
  In_Progress
  Blocked
  Review
  Completed
  Accepted
  Rejected
  Closed
}
set subsystem_choices {
}
', now());

-- Recolor the stock "All Tickets" report to match the new status values
-- instead of falling through to the grey ELSE case for all of them.
UPDATE reportfmt SET
  cols = '#ffffff Key:
#f2dcdc Open
#e8e8e8 In Progress / Review
#f5d6a8 Blocked
#cfe8bd Completed
#bde5d6 Accepted
#cacae5 Rejected
#c8c8c8 Closed',
  sqlcode = 'SELECT
  CASE WHEN status=''Open'' THEN ''#f2dcdc''
       WHEN status IN (''In_Progress'',''Review'') THEN ''#e8e8e8''
       WHEN status=''Blocked'' THEN ''#f5d6a8''
       WHEN status=''Completed'' THEN ''#cfe8bd''
       WHEN status=''Accepted'' THEN ''#bde5d6''
       WHEN status=''Rejected'' THEN ''#cacae5''
       ELSE ''#c8c8c8'' END AS ''bgcolor'',
  substr(tkt_uuid,1,10) AS ''#'',
  datetime(tkt_mtime) AS ''mtime'',
  type,
  status,
  subsystem,
  title
FROM ticket'
WHERE title = 'All Tickets';
