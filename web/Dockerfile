FROM node:18-alpine
WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy the rest of the app
COPY . .



EXPOSE 3000
CMD ["npm", "run", "dev"]
