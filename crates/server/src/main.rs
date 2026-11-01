use std::{io::IsTerminal, net::IpAddr, net::SocketAddr, path::PathBuf, sync::Arc};

use anyhow::Context;
use clap::Parser;
use mote_core::Notes;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(version)]
struct Args {
    /// The directory to store notes in.
    #[arg(long, env = "NOTES_DIR", default_value = "Notes")]
    notes_dir: PathBuf,
    /// The directory to store the cache in. Defaults to `.cache` inside the
    /// notes directory.
    #[arg(long, env = "CACHE_DIR")]
    cache_dir: Option<PathBuf>,
    #[arg(long, env = "BIND", default_value = "127.0.0.1")]
    bind: IpAddr,
    #[arg(long, env = "PORT", default_value_t = 5393)]
    port: u16,
    /// The maximum size of an asset in kibibyte (1024 bytes).
    #[arg(long, env = "MAX_ASSET_KIB", default_value_t = 10 * 1024)]
    max_asset_kib: u64,
    /// Print the OpenAPI spec and exit.
    #[arg(long)]
    openapi: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    if args.openapi {
        println!("{}", mote_server::openapi_json());
        return Ok(());
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_writer(std::io::stderr)
        .with_ansi(std::io::stderr().is_terminal())
        .init();

    let notes = Notes::open(
        &args.notes_dir,
        args.cache_dir.as_deref(),
        args.max_asset_kib * 1024,
    )
    .context("failed to open notes directory")?;
    let notes = Arc::new(notes);

    #[cfg(feature = "swagger")]
    let app = mote_server::app_with_swagger(notes);
    #[cfg(not(feature = "swagger"))]
    let app = mote_server::app(notes);

    let addr = SocketAddr::new(args.bind, args.port);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind {addr}"))?;
    tracing::info!(%addr, "listening");
    axum::serve(listener, app).await?;
    Ok(())
}
