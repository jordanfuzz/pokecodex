FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install --quiet

RUN npm install -g nodemon

COPY . .

EXPOSE 3004

CMD ["node", "./src"]