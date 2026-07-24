#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: "Pescatori di Uomini - complete remaining Admin sections (Schedule, Radio, Prayers, Messages/Testimonies, Users, Settings) + quick fixes (HTTP 201, testIDs)."

backend:
  - task: "Admin Prayers CRUD (list/detail/patch/delete) + status workflow"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New endpoints /api/admin/prayers (GET filter+search), /{id} GET, PATCH (status new|in_progress|prayed|archived + admin_notes), DELETE. Admin-guarded."
  - task: "Admin Messages/Testimonies CRUD + public testimonies"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/PATCH/DELETE /api/admin/messages (status new|reviewed|published|archived, type filter, admin_notes, editable text). Publishing sets published_at. Public GET /api/testimonies returns only published testimonies (no admin_notes)."
  - task: "Admin Users list + delete"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/users (search, is_admin flag). DELETE /api/admin/users/{id} blocks deleting admins (400)."
  - task: "Admin Programs (Palinsesto) CRUD"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET /api/admin/programs, POST (201), PATCH, DELETE /api/admin/programs/{id}. Public GET /api/programs unchanged."
  - task: "Admin Radio settings + General Settings"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/PUT /api/admin/radio (station_name, stream_url, backup_url, metadata_url, is_live, title, artist, artwork) persisted to live_status. GET/PUT /api/admin/settings + public GET /api/settings (contact/social/about)."
  - task: "HTTP 201 on CMS create (podcast/news/program)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "create_podcast, create_news, create_program now return status_code=201."

frontend:
  - task: "Admin new sections UI (prayers/messages/users/schedule/radio/settings)"
    implemented: true
    working: "NA"
    file: "frontend/app/admin/*"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "New admin screens created; require Google admin login so skip automated frontend admin testing unless seeded token available. Public messages screen now shows published testimonies."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1

test_plan:
  current_focus:
    - "Admin Prayers CRUD (list/detail/patch/delete) + status workflow"
    - "Admin Messages/Testimonies CRUD + public testimonies"
    - "Admin Programs (Palinsesto) CRUD"
    - "Admin Radio settings + General Settings"
    - "Admin Users list + delete"
    - "HTTP 201 on CMS create (podcast/news/program)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented all remaining admin backend sections. Please BACKEND-ONLY test the new endpoints. Admin auth: use seeded session token ADMINTESTTOKEN123 (Bearer) tied to pescatoridiuomini@outlook.it (conftest seeds it). Verify: admin guard (401 no token / 403 non-admin), prayers full workflow + status validation, messages/testimonies workflow (publish sets published_at, public /api/testimonies returns only published testimonies without admin_notes), programs CRUD with 201, radio GET/PUT persistence, settings GET/PUT + public /api/settings, users list+delete (admin delete blocked). Also confirm podcast/news create return 201."

## --- Merchandising module (session 3) ---
backend:
  - task: "Merchandising products CRUD + public catalog + reorder"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Public: GET /api/products (published only, search + category filter, sorted featured desc then order asc), GET /api/products/{id} (404 if missing), GET /api/products/categories (fixed list: Tutti+Abbigliamento/Cappelli/Tazze/Accessori/Libri/Altro). Admin (guarded): GET /api/admin/products (status filter published|hidden|featured, category, search), GET /{id}, POST (201, availability validated to available|coming_soon|sold_out => 400 invalid, order auto-set), PATCH (invalid availability => 400), DELETE, POST /api/admin/products/reorder {ids:[]} sets order. Fields: name, description, long_description, category, price(str), images[], colors[], sizes[], availability, featured, published. admin/stats now includes products count."

test_plan:
  current_focus:
    - "Merchandising products CRUD + public catalog + reorder"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "BACKEND-ONLY test the new Merchandising endpoints. Admin auth: Bearer ADMINTESTTOKEN123 (seeded by conftest). Verify: auth guard (401 no token, 403 non-admin, 200 admin) on /api/admin/products; create returns 201 + id; invalid availability on create AND patch returns 400; public GET /api/products returns only published products and NOT hidden ones; category + search filters; featured products sorted first; GET /api/products/{id} 404 for missing; reorder endpoint updates order and is reflected in list order; delete removes. Clean up TEST_-prefixed products. Products collection currently intentionally empty (empty-state feature)."
