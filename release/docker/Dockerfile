# ------------------------------------------------------------------------------
# Build builder-image stage
# ------------------------------------------------------------------------------

FROM ekidd/rust-musl-builder:1.51.0 AS builder-image

USER root

# Install needed tools
RUN apt-get update && \
	apt-get install -y apt-transport-https curl && \
	apt-get update && \
	apt-get install -y python-minimal libtool autoconf automake && \
	apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
	cargo install --version 0.1.20 cargo-chef

# Install nvm
RUN NVM_DIR="/root/.nvm" curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash

# ------------------------------------------------------------------------------
# Rust plan stage
# ------------------------------------------------------------------------------

FROM builder-image AS planner

WORKDIR /duniter

# copy source tree
COPY ./ ./

RUN cargo chef prepare --recipe-path recipe.json

# ------------------------------------------------------------------------------
# Rust cache stage
# ------------------------------------------------------------------------------

FROM builder-image AS cacher

WORKDIR /duniter

COPY --from=planner /duniter/recipe.json recipe.json

RUN cargo chef cook --release --target x86_64-unknown-linux-musl --recipe-path recipe.json

# ------------------------------------------------------------------------------
# Build stage
# ------------------------------------------------------------------------------

FROM builder-image AS builder

LABEL maintainer="elois <elois@duniter.org>"
LABEL version="0.1.0"
LABEL description="Duniter server (Crypto-currency software to manage libre currency such as Ğ1)"

ARG DUNITER_UI_VER="1.7.x"
ARG INSTALL_DEX="no"
ARG NODE_VERSION="10.24.1"

WORKDIR /duniter

# copy source tree
COPY ./ ./

# Copy over the rust cached dependencies
COPY --from=cacher /duniter/target target
COPY --from=cacher $CARGO_HOME $CARGO_HOME

# Install nodejs 10.x
RUN export NVM_DIR="$HOME/.nvm" && \
	. "$NVM_DIR/nvm.sh"  && \
	nvm install ${NODE_VERSION} && \
	nvm use ${NODE_VERSION}

# build duniter
RUN CARGO_BUILD_TARGET="x86_64-unknown-linux-musl" \
	PATH=${HOME}/.cargo/bin:${HOME}/.nvm/versions/node/v${NODE_VERSION}/bin:${PATH} \
	NVM_DIR="$HOME/.nvm" \
	RUSTFLAGS="-C target-feature=-crt-static -L/usr/lib" \
	make -C release ADD_DEBUG=N INSTALL_DEX=${INSTALL_DEX} TARGET_MUSL=yes server-gui clean \
	&& rm -rf work/extra

# ------------------------------------------------------------------------------
# Final stage
# ------------------------------------------------------------------------------

FROM node:10-alpine

ARG INSTALL_DEX="no"

# install jq
RUN apk add jq

# create group and user duniter
RUN addgroup -S -g 1111 duniter && \
	adduser -SD -h /duniter -G duniter -u 1111 duniter
RUN mkdir -p /var/lib/duniter /etc/duniter && chown duniter:duniter /var/lib/duniter /etc/duniter

# copy the build artifact from the build stage
COPY --from=builder --chown=duniter:duniter /duniter/work /duniter

# copy wrappers
COPY release/docker/duniter.sh /usr/bin/duniter
COPY release/docker/dex.sh /usr/bin/dex
RUN [ "$INSTALL_DEX" = yes ] || rm /usr/bin/dex

# copy entrypoint
COPY release/docker/docker-entrypoint.sh /

# create volumes
VOLUME /var/lib/duniter
VOLUME /etc/duniter

# expose ports
EXPOSE 9220 10901 20901 30901

# use duniter user
USER duniter
WORKDIR /var/lib/duniter

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD []
