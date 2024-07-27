FROM node:lts-bookworm-slim
SHELL ["bash", "-c"]
WORKDIR /home/node
COPY --chown=node:staff package.json .
COPY --chown=node:staff app app
USER node
RUN npm i --omit=dev
ENV TZ Asia/Tokyo
CMD ["npm", "start"]
