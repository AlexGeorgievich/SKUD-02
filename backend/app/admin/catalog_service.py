from ..hr.repository import HrRepository


class AdminCatalogService:
    KINDS = ("legal_entities", "offices", "departments", "positions")

    def __init__(self, repository: HrRepository):
        self.repository = repository

    def _kind(self, kind: str) -> None:
        if kind not in self.KINDS:
            raise ValueError("Неизвестный вид справочника")

    def list_all(self) -> dict[str, list[dict]]:
        source = self.repository.catalog_items()
        result = {}
        for kind in self.KINDS:
            items = []
            for item in source[kind]:
                usage = self.repository.catalog_usage(kind, item.id)
                row = {
                    "id": item.id,
                    "name": item.label if kind == "positions" else item.name,
                    **usage,
                }
                if kind == "departments":
                    row.update(office_id=item.office_id, head_id=item.head_id)
                items.append(row)
            result[kind] = items
        return result

    def create(self, kind: str, values: dict, author: str) -> dict:
        self._kind(kind)
        item = self.repository.create_catalog_item(kind, values)
        self.repository.add_audit(author, "catalog_create", kind, item["id"], {"fields": sorted(values)}, "manual")
        return {**item, **self.repository.catalog_usage(kind, item["id"])}

    def update(self, kind: str, item_id: str, values: dict, author: str) -> dict:
        self._kind(kind)
        item = self.repository.update_catalog_item(kind, item_id, values)
        self.repository.add_audit(author, "catalog_update", kind, item_id, {"fields": sorted(values)}, "manual")
        return {**item, **self.repository.catalog_usage(kind, item_id)}

    def delete(self, kind: str, item_id: str, author: str) -> None:
        self._kind(kind)
        self.repository.delete_catalog_item(kind, item_id)
        self.repository.add_audit(author, "catalog_delete", kind, item_id, {"id": item_id}, "manual")
