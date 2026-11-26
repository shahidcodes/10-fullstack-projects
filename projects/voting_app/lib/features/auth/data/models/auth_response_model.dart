import 'user_model.dart';

class AuthResponseModel {
  final UserModel user;
  final String accessToken;
  final String refreshToken;

  const AuthResponseModel({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>;
    final tokens = data['tokens'] as Map<String, dynamic>;

    return AuthResponseModel(
      user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }
}
