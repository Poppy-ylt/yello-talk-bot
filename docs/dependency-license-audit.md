# Dependency license and notice audit

Status as of 2026-10-07. This is a package-metadata and notice-presence inventory, not legal advice or a redistribution clearance. The clean source export does not include `node_modules`, `.next`, downloaded SDKs, or compiled packages.

## Lockfile inventory

| Lockfile | Locked packages | Installed in local QA tree | Findings |
| --- | ---: | ---: | --- |
| Root | 109 | 109 | `xmlhttprequest-ssl` has no license field in the lockfile, but its installed package metadata says MIT and includes `LICENSE`. Two installed package directories have no top-level license/notice file: nested `undici-types@5.26.5` and `tr46@0.0.3`; lock metadata says MIT. |
| Portal | 136 | 104 | No missing lockfile license fields; 32 lock entries are absent from this QA install. Four installed package directories have no top-level license/notice file: `@next/env@16.1.1`, `@next/swc-win32-x64-msvc@16.1.1`, `client-only@0.0.1`, and `dlv@1.1.3`; lock metadata says MIT. |
| Web adapter | 187 | 0 | No missing lockfile license fields. `argparse@2.0.1` declares `Python-2.0`; its source package is not installed or vendored in staging. |

The lockfiles contain the expected MIT, ISC, Apache-2.0, BSD, and 0BSD metadata, plus the cases below. The audit did not copy dependency source into the project. Missing top-level notice files are recorded as findings, not treated as proof that no upstream notice exists.

## Notices that need attention if dependencies are distributed

- `caniuse-lite@1.0.30001806` is marked CC-BY-4.0. Its upstream README asks users to attribute the source to caniuse.com; the installed package contains a `LICENSE` file. Preserve the attribution if distributing the data or an artifact that includes it. [Upstream README](https://github.com/browserslist/caniuse-lite/blob/main/README.md)
- The portal lockfile includes Next's optional `sharp@0.34.5` dependency. The installed Windows package `@img/sharp-win32-x64@0.34.5` declares `Apache-2.0 AND LGPL-3.0-or-later`. The sharp-libvips upstream notice lists the licenses of the native libraries in its packages, including LGPL components. If distributing installed/runtime packages, include the matching notice and satisfy applicable license terms; this clean source export contains none of those package payloads. [sharp 0.34.5 package metadata](https://github.com/lovell/sharp/blob/v0.34.5/npm/win32-x64/package.json), [sharp-libvips v1.2.4 notices](https://github.com/lovell/sharp-libvips/blob/v1.2.4/THIRD-PARTY-NOTICES.md)
- `argparse@2.0.1` in the Web adapter lockfile declares `Python-2.0`. The exact upstream tag includes its license text; preserve that package license if the dependency itself is redistributed. [argparse 2.0.1 package metadata](https://github.com/nodeca/argparse/blob/2.0.1/package.json), [argparse 2.0.1 license](https://github.com/nodeca/argparse/blob/2.0.1/LICENSE)

The source-only repository includes manifests and lockfiles, not these installed packages. Do not package `node_modules` or `.next` without a fresh per-platform notice and binary review.

## GME SDK rights remain separate and unresolved

GME SDK files used for a local Windows compile are outside this staging tree. No GME SDK or adapter SDK license/notice file was found in the reviewed source tree. Tencent's SDK download guide points to SDK integration/privacy/compliance materials but does not itself grant SDK redistribution rights. Tencent Cloud's general service agreement §7.1 describes IP ownership and the need for express permission; it is not a product-specific GME SDK redistribution license. Keep all GME SDK payloads out of public exports until the applicable product terms or written rights-holder permission are confirmed. [GME SDK download guide](https://cloud.tencent.com/document/product/607/18521), [Tencent Cloud Service Agreement §7.1](https://cloud.tencent.com/document/product/301/1967), [SPDX Python-2.0 entry](https://spdx.org/licenses/preview/Python-2.0.html)

## Remaining release checks

- Review the exact dependency artifacts in any future installer/runtime bundle and add the corresponding upstream `LICENSE`/`NOTICE` files and attribution.
- Recheck all three lockfiles after dependency updates; the Web adapter's locked dependencies have not been installed in this staging tree.
- Confirm source ownership/attribution for the imported adapters and obtain GME SDK redistribution terms before public release.
