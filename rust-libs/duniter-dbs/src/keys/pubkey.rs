//  Copyright (C) 2020 Éloïs SANCHEZ.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

use crate::*;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, PartialOrd)]
pub struct PubKeyKeyV1(pub PublicKey);

impl PubKeyKeyV1 {
    const ALL: &'static str = "ALL";
    const ALL_WITH_LEADING_1: &'static str = "11111111111111111111111111111ALL";

    pub fn all() -> Self {
        Self(PublicKey::from_base58(Self::ALL).expect("invalid PubKeyKeyV1::all()"))
    }
}

impl KeyAsBytes for PubKeyKeyV1 {
    fn as_bytes<T, F: FnMut(&[u8]) -> T>(&self, mut f: F) -> T {
        let b58_string = self.0.to_base58();
        if b58_string == Self::ALL_WITH_LEADING_1 {
            f(Self::ALL.as_bytes())
        } else {
            f(self.0.to_base58().as_bytes())
        }
    }
}

impl kv_typed::prelude::FromBytes for PubKeyKeyV1 {
    type Err = CorruptedBytes;

    fn from_bytes(bytes: &[u8]) -> std::result::Result<Self, Self::Err> {
        let pubkey_str = std::str::from_utf8(bytes).map_err(|e| CorruptedBytes(e.to_string()))?;
        Ok(PubKeyKeyV1(PublicKey::from_base58(&pubkey_str).map_err(
            |e| CorruptedBytes(format!("{}: {}", e, pubkey_str)),
        )?))
    }
}

impl ToDumpString for PubKeyKeyV1 {
    fn to_dump_string(&self) -> String {
        todo!()
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq, PartialOrd)]
pub struct PubKeyKeyV2(pub PublicKey);

impl KeyAsBytes for PubKeyKeyV2 {
    fn as_bytes<T, F: FnMut(&[u8]) -> T>(&self, mut f: F) -> T {
        f(self.0.as_ref())
    }
}

impl kv_typed::prelude::FromBytes for PubKeyKeyV2 {
    type Err = CorruptedBytes;

    fn from_bytes(bytes: &[u8]) -> std::result::Result<Self, Self::Err> {
        Ok(PubKeyKeyV2(PublicKey::try_from(bytes).map_err(|e| {
            CorruptedBytes(format!("{}: {:?}", e, bytes))
        })?))
    }
}

impl ToDumpString for PubKeyKeyV2 {
    fn to_dump_string(&self) -> String {
        todo!()
    }
}

#[cfg(feature = "explorer")]
impl ExplorableKey for PubKeyKeyV1 {
    fn from_explorer_str(source: &str) -> Result<Self, FromExplorerKeyErr> {
        Self::from_bytes(source.as_bytes()).map_err(|e| FromExplorerKeyErr(e.0.into()))
    }
    fn to_explorer_string(&self) -> KvResult<String> {
        self.as_bytes(|bytes| Ok(unsafe { std::str::from_utf8_unchecked(bytes) }.to_owned()))
    }
}

#[cfg(feature = "explorer")]
impl ExplorableKey for PubKeyKeyV2 {
    fn from_explorer_str(pubkey_str: &str) -> std::result::Result<Self, FromExplorerKeyErr> {
        Ok(PubKeyKeyV2(PublicKey::from_base58(&pubkey_str).map_err(
            |e| FromExplorerKeyErr(format!("{}: {}", e, pubkey_str).into()),
        )?))
    }
    fn to_explorer_string(&self) -> KvResult<String> {
        Ok(self.0.to_base58())
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    #[test]
    fn pubkey_all() {
        let all = PubKeyKeyV1::all();
        assert_eq!(
            all.as_bytes(|bytes| bytes.to_vec()),
            PubKeyKeyV1::ALL.as_bytes()
        )
    }
}
