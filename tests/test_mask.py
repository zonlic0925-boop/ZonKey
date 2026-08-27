from core.redact.mask import mask_placeholder, uses_asterisk_mask


def test_mask_placeholder_equal_length_stars():
    assert mask_placeholder('EL9115580', '*') == '*********'
    assert mask_placeholder('13800138000', '[已脱敏手机号]') == '***********'


def test_mask_placeholder_custom_text_preserved():
    assert mask_placeholder('张三', '[公司A]') == '[公司A]'
    assert uses_asterisk_mask('[已脱敏]') is True
    assert uses_asterisk_mask('[公司A]') is False
