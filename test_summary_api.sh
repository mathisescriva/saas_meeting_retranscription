#!/bin/bash

echo "🔍 Test des endpoints de résumé..."

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:8000"
TOKEN_FILE="$HOME/.auth_token"

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Base URL: $BASE_URL"
echo "  Token file: $TOKEN_FILE"

# Vérifier si le serveur répond
echo -e "\n${BLUE}🌐 Test de connexion au serveur...${NC}"
if curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Serveur accessible${NC}"
else
    echo -e "${RED}❌ Serveur non accessible${NC}"
    exit 1
fi

# Récupérer le token depuis localStorage (simulation)
echo -e "\n${BLUE}🔑 Récupération du token...${NC}"
if [ -f "$TOKEN_FILE" ]; then
    TOKEN=$(cat "$TOKEN_FILE")
    echo -e "${GREEN}✅ Token trouvé: ${TOKEN:0:20}...${NC}"
else
    echo -e "${YELLOW}⚠️  Pas de fichier token trouvé${NC}"
    echo "Veuillez copier votre token d'authentification depuis localStorage:"
    echo "1. Ouvrez la console du navigateur (F12)"
    echo "2. Tapez: localStorage.getItem('auth_token')"
    echo "3. Copiez le token et collez-le ici:"
    read -p "Token: " TOKEN
    echo "$TOKEN" > "$TOKEN_FILE"
fi

# Lister les réunions pour obtenir un ID réel
echo -e "\n${BLUE}📋 Liste des réunions...${NC}"
MEETINGS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/meetings/")

if echo "$MEETINGS_RESPONSE" | grep -q "detail.*Could not validate credentials"; then
    echo -e "${RED}❌ Token invalide${NC}"
    rm -f "$TOKEN_FILE"
    exit 1
fi

# Extraire le premier ID de réunion
MEETING_ID=$(echo "$MEETINGS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$MEETING_ID" ]; then
    echo -e "${YELLOW}⚠️  Aucune réunion trouvée${NC}"
    echo "Réponse API: $MEETINGS_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ ID de réunion trouvé: $MEETING_ID${NC}"

# Test 1: POST /meetings/{meeting_id}/generate-summary
echo -e "\n${BLUE}🎯 Test 1: POST /meetings/$MEETING_ID/generate-summary${NC}"
RESPONSE1=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/meetings/$MEETING_ID/generate-summary")

HTTP_CODE1=$(echo "$RESPONSE1" | grep "HTTP_CODE:" | cut -d: -f2)
BODY1=$(echo "$RESPONSE1" | sed '/HTTP_CODE:/d')

echo "Status: $HTTP_CODE1"
echo "Response: $BODY1"

# Test 2: GET /meetings/{meeting_id}/summary
echo -e "\n${BLUE}🎯 Test 2: GET /meetings/$MEETING_ID/summary${NC}"
RESPONSE2=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/meetings/$MEETING_ID/summary")

HTTP_CODE2=$(echo "$RESPONSE2" | grep "HTTP_CODE:" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | sed '/HTTP_CODE:/d')

echo "Status: $HTTP_CODE2"
echo "Response: $BODY2"

# Test 3: GET /meetings/{meeting_id} (détails complets)
echo -e "\n${BLUE}🎯 Test 3: GET /meetings/$MEETING_ID (détails complets)${NC}"
RESPONSE3=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/meetings/$MEETING_ID")

HTTP_CODE3=$(echo "$RESPONSE3" | grep "HTTP_CODE:" | cut -d: -f2)
BODY3=$(echo "$RESPONSE3" | sed '/HTTP_CODE:/d')

echo "Status: $HTTP_CODE3"
echo "Response: $BODY3"

# Résumé
echo -e "\n${BLUE}📊 Résumé des tests:${NC}"
echo "Test 1 (POST generate-summary): $HTTP_CODE1"
echo "Test 2 (GET summary): $HTTP_CODE2" 
echo "Test 3 (GET meeting details): $HTTP_CODE3"

if [ "$HTTP_CODE1" = "200" ] || [ "$HTTP_CODE1" = "201" ]; then
    echo -e "${GREEN}✅ Génération de résumé fonctionne${NC}"
else
    echo -e "${RED}❌ Problème avec la génération de résumé${NC}"
fi 