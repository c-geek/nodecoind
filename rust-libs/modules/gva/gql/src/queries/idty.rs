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

#[derive(Default)]
pub(crate) struct IdtyQuery;
#[async_graphql::Object]
impl IdtyQuery {
    /// Get identity by public key
    async fn idty(
        &self,
        ctx: &async_graphql::Context<'_>,
        #[graphql(desc = "public key")] pubkey: String,
    ) -> async_graphql::Result<Identity> {
        let pubkey = PublicKey::from_base58(&pubkey)?;

        let data = ctx.data::<GvaSchemaData>()?;
        let dbs_reader = data.dbs_reader();

        let pubkey_is_member = data
            .dbs_pool
            .execute(move |_| dbs_reader.pubkey_is_member(pubkey))
            .await??;

        Ok(Identity {
            is_member: pubkey_is_member.unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::*;

    #[tokio::test]
    async fn test_idty() -> anyhow::Result<()> {
        let mut dbs_reader = MockDbsReader::new();
        dbs_reader
            .expect_pubkey_is_member()
            .withf(|s| {
                s == &PublicKey::from_base58("DnjL6hYA1k7FavGHbbir79PKQbmzw63d6bsamBBdUULP")
                    .expect("wrong pubkey")
            })
            .times(1)
            .returning(|_| Ok(Some(true)));
        let schema = create_schema(dbs_reader)?;
        assert_eq!(
            exec_graphql_request(
                &schema,
                r#"{ idty(pubkey: "DnjL6hYA1k7FavGHbbir79PKQbmzw63d6bsamBBdUULP") {isMember} }"#
            )
            .await?,
            serde_json::json!({
                "data": {
                    "idty": {
                        "isMember": true
                    }
                }
            })
        );
        Ok(())
    }
}
