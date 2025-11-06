# ---- Build Stage ----
    FROM oven/bun:1.3.1 AS build
    WORKDIR /app
    
    # copy dependency manifests
    COPY package*.json ./
    
    # install deps but skip postinstall (avoids esbuild version check)
    RUN bun install --ignore-scripts
    
    # copy rest of the code
    COPY . .
    
    # build static production files (for Vite etc.)
    RUN bun run build
    
    # ---- Serve Stage ----
    FROM nginx:alpine
    
    # copy compiled output from previous stage
    COPY --from=build /app/dist /usr/share/nginx/html
    
    # expose the production port
    EXPOSE 80
    
    CMD ["nginx", "-g", "daemon off;"]
    