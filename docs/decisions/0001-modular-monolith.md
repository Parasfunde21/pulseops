# ADR 0001: Start with a modular monolith

## Status

Accepted

## Context

PulseOps will have several business domains, but its initial product surface and operational needs are small.

## Decision

Build one Express API application and arrange code by domain under `apps/api/src/modules`. Keep HTTP routing, configuration, middleware, and utilities as separate cross-cutting concerns.

## Consequences

The system is simple to run and test, and future domains have clear ownership boundaries. A module may be extracted later only when a demonstrated operational or organizational requirement justifies it.
