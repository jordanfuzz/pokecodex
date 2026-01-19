FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --include=optional

RUN npm install -g nodemon

COPY . .

EXPOSE 3003

CMD ["node", "./src"]