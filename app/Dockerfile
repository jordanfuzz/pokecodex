FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --include=optional

COPY . .

EXPOSE 3000

CMD ["npm", "start"]