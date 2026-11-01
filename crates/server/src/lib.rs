mod api_error;
mod dto;
mod openapi;
mod routes;
mod static_files;

use std::{sync::Arc, time::Duration};

use axum::http::Response;
use mote_core::Notes;
use tower_http::trace::{DefaultMakeSpan, TraceLayer};
use tracing::{Level, Span};

pub use openapi::openapi_json;

pub type AppState = Arc<Notes>;

fn log_response<B>(res: &Response<B>, latency: Duration, _: &Span) {
    let status = res.status();
    let latency_ms = latency.as_millis() as u64;
    if status.is_server_error() {
        tracing::error!(status = status.as_u16(), latency_ms, "response");
    } else if status.is_client_error() {
        tracing::info!(status = status.as_u16(), latency_ms, "response");
    } else {
        tracing::debug!(status = status.as_u16(), latency_ms, "response");
    }
}

fn with_trace(router: axum::Router) -> axum::Router {
    router.layer(
        TraceLayer::new_for_http()
            .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
            .on_response(log_response),
    )
}

pub fn app(notes: AppState) -> axum::Router {
    let limit = notes.max_asset_bytes();
    with_trace(
        openapi::router(limit as usize)
            .with_state(notes)
            .split_for_parts()
            .0
            .fallback(static_files::serve),
    )
}

#[cfg(feature = "swagger")]
pub fn app_with_swagger(notes: AppState) -> axum::Router {
    let limit = notes.max_asset_bytes();
    let (router, api) = openapi::router(limit as usize)
        .with_state(notes)
        .split_for_parts();
    with_trace(
        router
            .merge(
                utoipa_swagger_ui::SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", api),
            )
            .fallback(static_files::serve),
    )
}
