-- ============================================================
-- ADAM MCP Admin – full schema v1
-- ============================================================

-- Drop all existing tables in reverse dependency order
DROP TABLE IF EXISTS user_scope_permissions;
DROP TABLE IF EXISTS user_tool_permissions;
DROP TABLE IF EXISTS tools;
DROP TABLE IF EXISTS scopes;
DROP TABLE IF EXISTS users;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL UNIQUE,
  display_name TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,  -- 1 = active, 0 = disabled
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login   TEXT
);

CREATE INDEX idx_users_email ON users(email);

-- ------------------------------------------------------------
-- scopes  (e.g. "rentman.equipment.read", "odoo.read")
-- ------------------------------------------------------------
CREATE TABLE scopes (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- tools  (one row per MCP tool, references its required scope)
-- ------------------------------------------------------------
CREATE TABLE tools (
  name     TEXT    PRIMARY KEY,
  scope_id INTEGER NOT NULL REFERENCES scopes(id) ON DELETE RESTRICT
);

CREATE INDEX idx_tools_scope_id ON tools(scope_id);

-- ------------------------------------------------------------
-- user_scope_permissions  (grants a scope to a user)
-- ------------------------------------------------------------
CREATE TABLE user_scope_permissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  scope_id   INTEGER NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  granted_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, scope_id)
);

CREATE INDEX idx_usp_user_id  ON user_scope_permissions(user_id);
CREATE INDEX idx_usp_scope_id ON user_scope_permissions(scope_id);

-- ============================================================
-- Seed: scopes from tool-scopes.json
-- ============================================================
INSERT INTO scopes (name) VALUES
  ('rentman.equipment.read'),
  ('rentman.project.read'),
  ('rentman.invoice.read'),
  ('rentman.dashboard.read'),
  ('rentman.crew.read'),
  ('rentman.cegelosztas.read'),
  ('handover.write'),
  ('handover.read'),
  ('attachment.read'),
  ('attachment.write'),
  ('odoo.read');

-- ============================================================
-- Seed: tools from tool-scopes.json
-- ============================================================
INSERT INTO tools (name, scope_id) VALUES
  -- rentman.equipment.read
  ('list_equipment',                      (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('get_equipment_item',                  (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('search_equipment',                    (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('list_equipment_categories',           (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_audit_inventory',             (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_equipment_bulk',              (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_equipment_count_diff',        (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_kit_components',              (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_kit_audit',                   (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_red_shortage',                (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_kit_browse',                  (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_kit_contents',                (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_kit_tree',                    (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_equipment_export',            (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  ('rentman_equipment_field_audit',       (SELECT id FROM scopes WHERE name = 'rentman.equipment.read')),
  -- rentman.project.read
  ('rentman_project_search',              (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_project_get',                 (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_subproject_get',              (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_subproject_costs',            (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_subproject_health',           (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_critical_projects',           (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_upcoming_events',             (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_overdue_offers',              (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_offer_expiry_forecast',       (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_template_list',               (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_template_get',                (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_template_variables',          (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_template_diff',               (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_briefpapier_list',            (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_project_templates_list',      (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_project_template_get',        (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_project_template_usage',      (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  ('rentman_project_template_diff',       (SELECT id FROM scopes WHERE name = 'rentman.project.read')),
  -- rentman.invoice.read
  ('rentman_overdue_invoices',            (SELECT id FROM scopes WHERE name = 'rentman.invoice.read')),
  ('szamlazz_payment_diff',               (SELECT id FROM scopes WHERE name = 'rentman.invoice.read')),
  ('aam_keret_status',                    (SELECT id FROM scopes WHERE name = 'rentman.invoice.read')),
  -- rentman.dashboard.read
  ('rentman_pv_dashboard',                (SELECT id FROM scopes WHERE name = 'rentman.dashboard.read')),
  ('rentman_daily_briefing',              (SELECT id FROM scopes WHERE name = 'rentman.dashboard.read')),
  -- rentman.crew.read
  ('rentman_crew_assignments',            (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_crew_list',                   (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_function_list',               (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_function_group_list',         (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_rate_table',                  (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_monthly_schedule_per_person', (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_crew_cost_per_project',       (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  ('rentman_planning_conflicts',          (SELECT id FROM scopes WHERE name = 'rentman.crew.read')),
  -- rentman.cegelosztas.read
  ('cegelosztas_audit',                   (SELECT id FROM scopes WHERE name = 'rentman.cegelosztas.read')),
  -- handover.write
  ('save_daily_report',                   (SELECT id FROM scopes WHERE name = 'handover.write')),
  ('save_handover',                       (SELECT id FROM scopes WHERE name = 'handover.write')),
  ('delete_handover',                     (SELECT id FROM scopes WHERE name = 'handover.write')),
  -- handover.read
  ('list_handover_inbox',                 (SELECT id FROM scopes WHERE name = 'handover.read')),
  ('read_handover',                       (SELECT id FROM scopes WHERE name = 'handover.read')),
  -- attachment.read
  ('list_attachments',                    (SELECT id FROM scopes WHERE name = 'attachment.read')),
  ('read_attachment',                     (SELECT id FROM scopes WHERE name = 'attachment.read')),
  -- attachment.write
  ('save_attachment',                     (SELECT id FROM scopes WHERE name = 'attachment.write')),
  ('delete_attachment',                   (SELECT id FROM scopes WHERE name = 'attachment.write')),
  -- odoo.read
  ('odoo_partner_search',                 (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_partner_get',                    (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_product_query',                  (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_product_weights',                (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_product_full_audit',             (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_bom_lines',                      (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_bom_audit',                      (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_so_search',                      (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_so_get',                         (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_so_lines_for_product',           (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_po_search',                      (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_po_get',                         (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_po_lines_for_product',           (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_supplierinfo_for_product',       (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_pricelist_list',                 (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_pricelist_items',                (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_pricelist_apply',                (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_stock',                          (SELECT id FROM scopes WHERE name = 'odoo.read')),
  ('odoo_record_query',                   (SELECT id FROM scopes WHERE name = 'odoo.read'));
