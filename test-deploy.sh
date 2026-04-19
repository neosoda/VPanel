#!/bin/bash

# Vpanel Coolify Deployment Test Suite
set -e

IMAGE_NAME="vpanel:test"
CONTAINER_NAME="vpanel-test"
BASE_URL="http://localhost:8080"
BUILD_LOG="/tmp/vpanel-build.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

log_header() {
    echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"
}

log_info() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $*"
}

cleanup() {
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
}

trap cleanup EXIT

test_endpoint() {
    local method=$1 endpoint=$2 expected_code=$3 description=$4
    TESTS_RUN=$((TESTS_RUN + 1))
    
    code=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL$endpoint")
    
    if [ "$code" = "$expected_code" ]; then
        log_info "$method $endpoint → HTTP $code"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$method $endpoint → HTTP $code (expected $expected_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

main() {
    local phase="${1:-all}"
    
    case "$phase" in
        build)
            log_header "PHASE 1: Docker Build"
            if docker build -t "$IMAGE_NAME" . > "$BUILD_LOG" 2>&1; then
                log_info "Build successful"
                SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
                log_info "Image size: $SIZE"
            else
                log_error "Build failed"
                tail -20 "$BUILD_LOG"
                exit 1
            fi
            ;;
        start)
            log_header "PHASE 2: Container Startup"
            docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
            
            if docker run -d --name "$CONTAINER_NAME" -p 8080:8080 "$IMAGE_NAME" >/dev/null 2>&1; then
                log_info "Container started"
                
                for i in {1..20}; do
                    if docker exec "$CONTAINER_NAME" /healthcheck.sh >/dev/null 2>&1; then
                        log_info "Healthcheck passed (attempt $i)"
                        break
                    fi
                    sleep 1
                done
            else
                log_error "Container startup failed"
                exit 1
            fi
            ;;
        test)
            log_header "PHASE 3: Functional Tests"
            test_endpoint "GET" "/" "200" "Frontend"
            test_endpoint "GET" "/infos.json" "200" "App info"
            test_endpoint "GET" "/api/health.php" "200" "API health"
            test_endpoint "GET" "/api/resume.php" "200" "Resume API"
            test_endpoint "GET" "/nonexistent" "200" "SPA routing"
            ;;
        validate)
            log_header "PHASE 4: Log Validation"
            LOGS=$(docker logs "$CONTAINER_NAME" 2>&1)
            
            if echo "$LOGS" | grep -iE "fatal|parse error" >/dev/null; then
                log_error "Fatal errors detected in logs"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            else
                log_info "No fatal errors in logs"
                TESTS_PASSED=$((TESTS_PASSED + 1))
            fi
            TESTS_RUN=$((TESTS_RUN + 1))
            ;;
        restart)
            log_header "PHASE 5: Restart Test"
            docker stop "$CONTAINER_NAME" >/dev/null 2>&1
            sleep 2
            docker start "$CONTAINER_NAME" >/dev/null 2>&1
            
            for i in {1..10}; do
                if docker exec "$CONTAINER_NAME" /healthcheck.sh >/dev/null 2>&1; then
                    log_info "Restart successful (attempt $i)"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                    TESTS_RUN=$((TESTS_RUN + 1))
                    return 0
                fi
                sleep 1
            done
            
            log_error "Restart failed"
            TESTS_FAILED=$((TESTS_FAILED + 1))
            TESTS_RUN=$((TESTS_RUN + 1))
            ;;
        all)
            $0 build && sleep 2 && $0 start && sleep 3 && $0 test && $0 validate && $0 restart
            
            log_header "SUMMARY"
            echo "Tests run:    $TESTS_RUN"
            echo "Passed:       ${GREEN}$TESTS_PASSED${NC}"
            echo "Failed:       ${RED}$TESTS_FAILED${NC}"
            
            if [ $TESTS_FAILED -eq 0 ]; then
                log_info "ALL TESTS PASSED - Ready for production"
            else
                log_error "Some tests failed"
                exit 1
            fi
            ;;
        *)
            echo "Usage: $0 {build|start|test|validate|restart|all}"
            exit 1
            ;;
    esac
}

main "$@"
