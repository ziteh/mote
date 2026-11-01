FROM scratch
COPY --chmod=755 mote-server-x86_64-linux /mote-server
ENTRYPOINT ["/mote-server"]
